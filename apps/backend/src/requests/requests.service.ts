import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from './entities/request.entity';
import { EmployeesService } from '../employees/employees.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    private readonly employeesService: EmployeesService,
    private readonly mail: MailService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll(): Promise<Request[]> {
    return this.requestRepo.find({ order: { createdAt: 'DESC' } });
  }

  findMine(userId: string): Promise<Request[]> {
    return this.requestRepo.find({ where: { createdById: userId }, order: { createdAt: 'DESC' } });
  }

  /**
   * employeeName/employeeId/department are resolved from the requester's own
   * employee record rather than trusted from the request body — the caller
   * only needs to supply what the request is actually about (kind/title/etc).
   * Falls back gracefully when the user has no employee row (e.g. a bare
   * admin account), instead of crashing on a NOT NULL insert.
   */
  async create(data: Partial<Request>, userId: string): Promise<Request> {
    const employee = await this.employeesService.findByUserId(userId).catch(() => null);
    const employeeName = employee
      ? `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || undefined
      : undefined;
    const saved = await this.requestRepo.save(this.requestRepo.create({
      ...data,
      employeeName: employeeName ?? data.employeeName,
      employeeId: employee?.employeeId ?? data.employeeId,
      department: employee?.department ?? data.department,
      createdById: userId,
      status: 'pending',
    }));
    // Not awaited: notification email(s) must never add SMTP latency to the response.
    void this.notifySubmitted(saved);
    return saved;
  }

  private async setStatus(id: string, status: string): Promise<Request> {
    const r = await this.requestRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    r.status = status;
    const saved = await this.requestRepo.save(r);
    void this.notifyDecided(saved);
    return saved;
  }

  issue(id: string) { return this.setStatus(id, 'issued'); }
  reject(id: string) { return this.setStatus(id, 'rejected'); }

  /** Email the submitter a confirmation and alert HR/admin of the new request. Never breaks create(). */
  private async notifySubmitted(request: Request): Promise<void> {
    try {
      if (!request.createdById) return;
      const creator = await this.users.findOne(request.createdById).catch(() => null);
      const applicantSubject = 'Request submitted';
      const applicantBody = `Your ${request.kind} request — "${request.title}" has been submitted and is pending approval.`;
      if (creator?.email) await this.mail.send(creator.email, applicantSubject, applicantBody);
      if (creator?.expoPushToken) await this.notifications.sendToDevice(creator.expoPushToken, applicantSubject, applicantBody, { type: 'request', requestId: request.id });

      const approvers = await this.users.findApprovers();
      const who = request.employeeName || creator?.email || 'An employee';
      const approverSubject = 'New request pending approval';
      const approverBody = `${who} raised a new ${request.kind} request — "${request.title}". Review it in the HR dashboard.`;
      await Promise.all(approvers.map((a) => this.mail.send(a.email, approverSubject, approverBody)));
      const approverTokens = approvers.map((a) => a.expoPushToken).filter((t): t is string => !!t);
      await this.notifications.sendToMultiple(approverTokens, approverSubject, approverBody, { type: 'request', requestId: request.id });
    } catch (err: any) {
      this.logger.error(`Failed to send request-submitted email: ${err?.message}`);
    }
  }

  /** Email the submitter once HR issues/rejects their request. Never breaks issue()/reject(). */
  private async notifyDecided(request: Request): Promise<void> {
    try {
      if (!request.createdById) return;
      const creator = await this.users.findOne(request.createdById).catch(() => null);
      if (!creator) return;
      const verb = request.status === 'issued' ? 'approved' : request.status;
      const subject = `Request ${verb}`;
      const body = `Your ${request.kind} request — "${request.title}" has been ${verb}.`;
      if (creator.email) await this.mail.send(creator.email, subject, body);
      if (creator.expoPushToken) await this.notifications.sendToDevice(creator.expoPushToken, subject, body, { type: 'request', requestId: request.id });
    } catch (err: any) {
      this.logger.error(`Failed to send request-decided email: ${err?.message}`);
    }
  }
}
