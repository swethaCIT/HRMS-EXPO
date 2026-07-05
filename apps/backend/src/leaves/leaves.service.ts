import { Injectable, NotFoundException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Leave, LeaveStatus } from './entities/leave.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class LeavesService {
  private readonly logger = new Logger(LeavesService.name);

  constructor(
    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly notifications: NotificationsService,
  ) {}

  private balanceKey(employeeId: string) {
    return `leaves:balance:${employeeId}`;
  }

  private fmtDate(d: Date | string): string {
    return new Date(d).toISOString().slice(0, 10);
  }

  async create(dto: CreateLeaveDto): Promise<Leave> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leave = this.leaveRepo.create({
      ...dto,
      employee: { id: dto.employeeId } as any,
      startDate: start,
      endDate: end,
      totalDays,
    });
    const saved = await this.leaveRepo.save(leave);
    await this.cache.del(this.balanceKey(dto.employeeId));
    return saved;
  }

  async findAll(): Promise<Leave[]> {
    return this.leaveRepo.find({ relations: { employee: true } });
  }

  async findByEmployee(employeeId: string): Promise<Leave[]> {
    return this.leaveRepo.find({ where: { employee: { id: employeeId } } });
  }

  async approve(id: string, approverId: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({ where: { id }, relations: { employee: { user: true } } });
    if (!leave) throw new NotFoundException('Leave not found');
    leave.status = LeaveStatus.APPROVED;
    leave.approvedById = approverId;
    leave.decidedAt = new Date();
    const saved = await this.leaveRepo.save(leave);
    if (leave.employee?.id) await this.cache.del(this.balanceKey(leave.employee.id));
    await this.notify(
      leave,
      'Leave approved',
      `Your ${leave.type} leave (${this.fmtDate(leave.startDate)} to ${this.fmtDate(leave.endDate)}) has been approved.`,
    );
    return saved;
  }

  async reject(id: string, reason: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({ where: { id }, relations: { employee: { user: true } } });
    if (!leave) throw new NotFoundException('Leave not found');
    leave.status = LeaveStatus.REJECTED;
    leave.rejectionReason = reason;
    leave.decidedAt = new Date();
    leave.decisionNote = reason;
    const saved = await this.leaveRepo.save(leave);
    if (leave.employee?.id) await this.cache.del(this.balanceKey(leave.employee.id));
    await this.notify(
      leave,
      'Leave rejected',
      `Your ${leave.type} leave (${this.fmtDate(leave.startDate)} to ${this.fmtDate(leave.endDate)}) has been rejected.` +
        (reason ? ` Reason: ${reason}` : ''),
    );
    return saved;
  }

  /** Employee withdraws their own pending leave request. */
  async cancel(id: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({ where: { id }, relations: { employee: true } });
    if (!leave) throw new NotFoundException('Leave not found');
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leaves can be cancelled');
    }
    leave.status = LeaveStatus.CANCELLED;
    const saved = await this.leaveRepo.save(leave);
    if (leave.employee?.id) await this.cache.del(this.balanceKey(leave.employee.id));
    return saved;
  }

  /** Notify the employee who submitted the leave. Never breaks the approve/reject flow. */
  private async notify(leave: Leave, title: string, body: string): Promise<void> {
    try {
      const userId = leave.employee?.user?.id;
      if (!userId) return;
      await this.notifications.createForUser(userId, title, body, NotificationType.LEAVE);
    } catch (err: any) {
      this.logger.error(`Failed to create leave notification: ${err?.message}`);
    }
  }

  /**
   * Leave balance = annual allocation − approved days taken this year (auto-computed,
   * so approving/rejecting a leave immediately reflects in the balance).
   */
  private static readonly ALLOCATION: Record<string, number> = {
    annual: 12, sick: 8, casual: 6, emergency: 3, maternity: 182, paternity: 15,
  };
  private static readonly COUNTED = ['annual', 'sick', 'casual', 'emergency'];

  async getBalance(employeeId: string) {
    const key = this.balanceKey(employeeId);
    const cached = await this.cache.get(key);
    if (cached) return cached;
    const leaves = await this.leaveRepo.find({ where: { employee: { id: employeeId } } });
    const year = new Date().getFullYear();
    const acc: Record<string, { used: number; pending: number }> = {};
    for (const l of leaves) {
      const y = new Date(l.startDate).getFullYear();
      if (y !== year) continue;
      const a = (acc[l.type] = acc[l.type] || { used: 0, pending: 0 });
      const days = Number(l.totalDays) || 0;
      if (l.status === LeaveStatus.APPROVED) a.used += days;
      else if (l.status === LeaveStatus.PENDING) a.pending += days;
    }
    const byType = Object.entries(LeavesService.ALLOCATION).map(([type, allocated]) => {
      const a = acc[type] || { used: 0, pending: 0 };
      return { type, allocated, used: a.used, pending: a.pending, remaining: Math.max(0, allocated - a.used) };
    });
    const totalRemaining = byType
      .filter((b) => LeavesService.COUNTED.includes(b.type))
      .reduce((s, b) => s + b.remaining, 0);
    const result = { year, totalRemaining, byType };
    await this.cache.set(key, result, 30_000); // balance changes only on approve/reject
    return result;
  }
}
