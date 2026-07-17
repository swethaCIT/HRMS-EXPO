import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({ ...dto, password: hashed });
    return this.userRepo.save(user);
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

  async update(id: string, dto: UpdateUserDto): Promise<User> {
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
    return this.findOne(id);
  }

  async updateFcmToken(id: string, token: string): Promise<void> {
    await this.userRepo.update(id, { fcmToken: token });
  }

  /* ── Password reset ── */
  async setResetToken(id: string, resetTokenHash: string, resetTokenExpires: Date): Promise<void> {
    await this.userRepo.update(id, { resetTokenHash, resetTokenExpires });
  }

  async setPassword(id: string, plainPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(plainPassword, 10);
    await this.userRepo.update(id, { password: hashed, resetTokenHash: null as any, resetTokenExpires: null as any });
  }

  async remove(id: string): Promise<void> {
    const current = await this.findOne(id);
    if (await this.isLastActiveAdmin(current)) {
      throw new BadRequestException('Cannot remove the last active admin — promote another user to admin first.');
    }
    await this.userRepo.softDelete(id);
    await this.cache.del(`auth:user:${id}`);
  }
}
