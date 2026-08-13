import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService, AuditActor } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, actor?: AuditActor): Promise<User> {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, 10);
    // Default applied here, not on the DTO — see CreateUserDto.role.
    const user = this.userRepo.create({ ...dto, role: dto.role ?? UserRole.EMPLOYEE, password: hashed });
    const saved = await this.userRepo.save(user);
    void this.audit.record({
      action: AuditAction.CREATED,
      entityType: 'user',
      entityId: saved.id,
      entityLabel: saved.email,
      actor,
      subjectId: saved.id,
      subjectName: saved.email,
      summary: `${actor?.name ?? 'Someone'} created the ${saved.role} account ${saved.email}`,
    });
    return saved;
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  /**
   * Users who can approve a request — the audience for "new request pending
   * approval" emails. Defaults to HR + admin; pass roles explicitly to also
   * include managers where they're allowed to approve (leaves, tickets).
   */
  async findApprovers(roles: UserRole[] = [UserRole.HR, UserRole.ADMIN]): Promise<User[]> {
    return this.userRepo.find({
      where: roles.map((role) => ({ role, isActive: true })),
    });
  }

  /** True if `user` is the only remaining active admin — demoting/deactivating
   * them would leave nobody able to manage users (this endpoint is admin-only),
   * a permanent lockout with no way back in except a manual DB fix. */
  private async isLastActiveAdmin(user: User): Promise<boolean> {
    if (user.role !== UserRole.ADMIN || !user.isActive) return false;
    const otherActiveAdmins = await this.userRepo.count({ where: { role: UserRole.ADMIN, isActive: true } });
    return otherActiveAdmins <= 1;
  }

  async update(id: string, dto: UpdateUserDto, actor?: AuditActor): Promise<User> {
    const current = await this.findOne(id);
    const demoting = dto.role !== undefined && dto.role !== UserRole.ADMIN;
    const deactivating = dto.isActive === false;
    if ((demoting || deactivating) && (await this.isLastActiveAdmin(current))) {
      throw new BadRequestException('Cannot demote or deactivate the last active admin — promote another user to admin first.');
    }
    await this.userRepo.update(id, dto);
    // Drop the cached auth record so role/isActive changes apply on the next
    // request instead of waiting out the JwtStrategy TTL.
    await this.cache.del(`auth:user:${id}`);
    const updated = await this.findOne(id);

    // Granting or revoking privilege is the single most sensitive thing an
    // admin does, so it gets its own entry rather than a generic "updated".
    if (dto.role !== undefined && dto.role !== current.role) {
      void this.audit.record({
        action: AuditAction.ROLE_CHANGED,
        entityType: 'user',
        entityId: id,
        entityLabel: current.email,
        actor,
        subjectId: id,
        subjectName: current.email,
        changes: [{ field: 'Role', from: current.role, to: dto.role }],
        summary: `${actor?.name ?? 'An admin'} changed ${current.email} from ${current.role} to ${dto.role}`,
      });
    }
    if (dto.isActive !== undefined && dto.isActive !== current.isActive) {
      void this.audit.record({
        action: dto.isActive ? AuditAction.ACTIVATED : AuditAction.DEACTIVATED,
        entityType: 'user',
        entityId: id,
        entityLabel: current.email,
        actor,
        subjectId: id,
        subjectName: current.email,
        summary: `${actor?.name ?? 'An admin'} ${dto.isActive ? 'activated' : 'deactivated'} ${current.email}`,
      });
    }
    return updated;
  }

  async updateExpoPushToken(id: string, token: string): Promise<void> {
    await this.userRepo.update(id, { expoPushToken: token });
  }

  /* ── Password reset ── */
  async setResetToken(id: string, resetTokenHash: string, resetTokenExpires: Date): Promise<void> {
    // Reset the attempt counter: a freshly issued code starts with a clean slate.
    await this.userRepo.update(id, { resetTokenHash, resetTokenExpires, resetAttempts: 0 });
  }

  /** Record a failed OTP guess against the current reset token. */
  async setResetAttempts(id: string, resetAttempts: number): Promise<void> {
    await this.userRepo.update(id, { resetAttempts });
  }

  /** Invalidate the reset token — after use, or after too many wrong guesses. */
  async clearResetToken(id: string): Promise<void> {
    await this.userRepo.update(id, {
      resetTokenHash: null as any,
      resetTokenExpires: null as any,
      resetAttempts: 0,
    });
  }

  async setPassword(id: string, plainPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(plainPassword, 10);
    await this.userRepo.update(id, { password: hashed, resetTokenHash: null as any, resetTokenExpires: null as any });
  }

  async remove(id: string, actor?: AuditActor): Promise<void> {
    const current = await this.findOne(id);
    if (await this.isLastActiveAdmin(current)) {
      throw new BadRequestException('Cannot remove the last active admin — promote another user to admin first.');
    }
    await this.userRepo.softDelete(id);
    await this.cache.del(`auth:user:${id}`);
    // Deliberately after the delete: the row is gone, so the log is the only
    // remaining record that this account ever existed.
    void this.audit.record({
      action: AuditAction.DELETED,
      entityType: 'user',
      entityId: id,
      entityLabel: current.email,
      actor,
      subjectId: id,
      subjectName: current.email,
      summary: `${actor?.name ?? 'An admin'} deleted the ${current.role} account ${current.email}`,
    });
  }
}
