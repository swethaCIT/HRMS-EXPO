import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Regularization, RegularizationStatus } from './entities/regularization.entity';
import { CreateRegularizationDto } from './dto/create-regularization.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class RegularizationsService {
  private readonly logger = new Logger(RegularizationsService.name);

  constructor(
    @InjectRepository(Regularization)
    private readonly regRepo: Repository<Regularization>,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly users: UsersService,
  ) {}

  private fmtDate(d: Date | string): string {
    return new Date(d).toISOString().slice(0, 10);
  }

  private fmtTime(d?: Date | string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  async create(dto: CreateRegularizationDto): Promise<Regularization> {
    const reg = this.regRepo.create({
      employee: { id: dto.employeeId } as any,
      date: new Date(dto.date),
      requestedCheckIn: dto.requestedCheckIn ? new Date(dto.requestedCheckIn) : undefined,
      requestedCheckOut: dto.requestedCheckOut ? new Date(dto.requestedCheckOut) : undefined,
      reason: dto.reason,
    });
    const saved = await this.regRepo.save(reg);
    void this.notifyApplied(saved.id);
    return saved;
  }

  findAll(): Promise<Regularization[]> {
    return this.regRepo.find({ relations: { employee: true }, order: { createdAt: 'DESC' } });
  }

  findByEmployee(employeeId: string): Promise<Regularization[]> {
    return this.regRepo.find({ where: { employee: { id: employeeId } }, order: { createdAt: 'DESC' } });
  }

  async approve(id: string, approverId: string): Promise<Regularization> {
    const reg = await this.regRepo.findOne({ where: { id }, relations: { employee: { user: true } } });
    if (!reg) throw new NotFoundException('Regularization request not found');
    reg.status = RegularizationStatus.APPROVED;
    reg.approvedById = approverId;
    reg.decidedAt = new Date();
    const saved = await this.regRepo.save(reg);
    void this.notify(reg, 'Regularization approved', `Your attendance correction for ${this.fmtDate(reg.date)} has been approved.`);
    return saved;
  }

  async reject(id: string, reason?: string): Promise<Regularization> {
    const reg = await this.regRepo.findOne({ where: { id }, relations: { employee: { user: true } } });
    if (!reg) throw new NotFoundException('Regularization request not found');
    reg.status = RegularizationStatus.REJECTED;
    reg.decidedAt = new Date();
    reg.decisionNote = reason ?? '';
    const saved = await this.regRepo.save(reg);
    void this.notify(
      reg,
      'Regularization rejected',
      `Your attendance correction for ${this.fmtDate(reg.date)} has been rejected.` + (reason ? ` Reason: ${reason}` : ''),
    );
    return saved;
  }

  /** Notify the employee who submitted the request. Never breaks approve/reject. */
  private async notify(reg: Regularization, title: string, body: string): Promise<void> {
    try {
      const user = reg.employee?.user;
      if (!user?.id) return;
      await this.notifications.createForUser(user.id, title, body, NotificationType.SYSTEM);
      if (user.email) await this.mail.send(user.email, title, body);
      if (user.fcmToken) await this.notifications.sendToDevice(user.fcmToken, title, body, { type: 'regularization', regularizationId: reg.id });
    } catch (err: any) {
      this.logger.error(`Failed to notify on regularization decision: ${err?.message}`);
    }
  }

  /** Email the applicant a confirmation and alert Manager/HR/Admin of the new request. */
  private async notifyApplied(regId: string): Promise<void> {
    try {
      const reg = await this.regRepo.findOne({ where: { id: regId }, relations: { employee: { user: true } } });
      if (!reg?.employee) return;
      const applicantName = `${reg.employee.firstName ?? ''} ${reg.employee.lastName ?? ''}`.trim() || 'An employee';
      const when = this.fmtDate(reg.date);
      const times = `check-in ${this.fmtTime(reg.requestedCheckIn)} · check-out ${this.fmtTime(reg.requestedCheckOut)}`;

      const applicantUser = reg.employee.user;
      const applicantSubject = 'Regularization request submitted';
      const applicantBody = `Your attendance correction for ${when} (${times}) has been submitted and is pending approval.`;
      if (applicantUser?.email) await this.mail.send(applicantUser.email, applicantSubject, applicantBody);
      if (applicantUser?.fcmToken) await this.notifications.sendToDevice(applicantUser.fcmToken, applicantSubject, applicantBody, { type: 'regularization', regularizationId: reg.id });

      const approvers = await this.users.findApprovers([UserRole.MANAGER, UserRole.HR, UserRole.ADMIN]);
      const approverSubject = 'New regularization request pending approval';
      const approverBody = `${applicantName} requested an attendance correction for ${when} (${times}). Review it in the Approvals inbox.`;
      await Promise.all(approvers.map((a) => this.mail.send(a.email, approverSubject, approverBody)));
      const approverTokens = approvers.map((a) => a.fcmToken).filter((t): t is string => !!t);
      await this.notifications.sendToMultiple(approverTokens, approverSubject, approverBody, { type: 'regularization', regularizationId: reg.id });
    } catch (err: any) {
      this.logger.error(`Failed to send regularization-applied email: ${err?.message}`);
    }
  }
}
