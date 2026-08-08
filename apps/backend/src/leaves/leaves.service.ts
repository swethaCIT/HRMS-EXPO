import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Leave, LeaveStatus } from './entities/leave.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { clampPaging } from '../common/utils/pagination';

@Injectable()
export class LeavesService {
  private readonly logger = new Logger(LeavesService.name);

  constructor(
    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly users: UsersService,
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
    // Not awaited: notifications (in-app + email, possibly to several approvers)
    // must never add SMTP round-trip latency to the create response.
    void this.notifyApplied(saved.id);
    return saved;
  }

  /** Org-wide leave, bounded and newest-first (backs the approvals inbox). */
  async findAll(limit?: number, offset?: number): Promise<Leave[]> {
    const { take, skip } = clampPaging(limit, offset);
    return this.leaveRepo.find({
      relations: { employee: true },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
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
    void this.notify(
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
    void this.notify(
      leave,
      'Leave rejected',
      `Your ${leave.type} leave (${this.fmtDate(leave.startDate)} to ${this.fmtDate(leave.endDate)}) has been rejected.` +
        (reason ? ` Reason: ${reason}` : ''),
    );
    return saved;
  }

  /**
   * Employee withdraws their own pending leave request. `actorEmployeeId` is
   * checked against the applicant unless the caller is privileged — otherwise
   * anyone could cancel a colleague's approved-in-waiting leave by id.
   */
  async cancel(id: string, actor?: { privileged?: boolean; actorEmployeeId?: string }): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({ where: { id }, relations: { employee: true } });
    if (!leave) throw new NotFoundException('Leave not found');
    if (!actor?.privileged && leave.employee?.id !== actor?.actorEmployeeId) {
      throw new ForbiddenException('You can only cancel your own leave request.');
    }
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
      const user = leave.employee?.user;
      if (!user?.id) return;
      await this.notifications.createForUser(user.id, title, body, NotificationType.LEAVE);
      if (user.email) await this.mail.send(user.email, title, body);
      if (user.fcmToken) await this.notifications.sendToDevice(user.fcmToken, title, body, { type: 'leave', leaveId: leave.id });
    } catch (err: any) {
      this.logger.error(`Failed to create leave notification: ${err?.message}`);
    }
  }

  /** Email the applicant a confirmation and alert HR/admin of the new request. Never breaks create(). */
  private async notifyApplied(leaveId: string): Promise<void> {
    try {
      const leave = await this.leaveRepo.findOne({ where: { id: leaveId }, relations: { employee: { user: true } } });
      if (!leave?.employee) return;
      const range = `${this.fmtDate(leave.startDate)} to ${this.fmtDate(leave.endDate)}`;
      const applicantName = `${leave.employee.firstName ?? ''} ${leave.employee.lastName ?? ''}`.trim() || 'An employee';

      const applicantUser = leave.employee.user;
      const applicantSubject = 'Leave request submitted';
      const applicantBody = `Your ${leave.type} leave request (${range}, ${leave.totalDays} day(s)) has been submitted and is pending approval.`;
      if (applicantUser?.email) await this.mail.send(applicantUser.email, applicantSubject, applicantBody);
      if (applicantUser?.fcmToken) await this.notifications.sendToDevice(applicantUser.fcmToken, applicantSubject, applicantBody, { type: 'leave', leaveId: leave.id });

      const approvers = await this.users.findApprovers([UserRole.MANAGER, UserRole.HR, UserRole.ADMIN]);
      const approverSubject = 'New leave request pending approval';
      const approverBody = `${applicantName} applied for ${leave.type} leave (${range}, ${leave.totalDays} day(s)). Review it in the HR dashboard.`;
      await Promise.all(approvers.map((a) => this.mail.send(a.email, approverSubject, approverBody)));
      const approverTokens = approvers.map((a) => a.fcmToken).filter((t): t is string => !!t);
      await this.notifications.sendToMultiple(approverTokens, approverSubject, approverBody, { type: 'leave', leaveId: leave.id });
    } catch (err: any) {
      this.logger.error(`Failed to send leave-applied email: ${err?.message}`);
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
