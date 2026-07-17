import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from './entities/request.entity';
import { EmployeesService } from '../employees/employees.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    private readonly employeesService: EmployeesService,
    private readonly mail: MailService,
    private readonly users: UsersService,
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
    await this.notifySubmitted(saved);
    return saved;
  }

  private async setStatus(id: string, status: string): Promise<Request> {
    const r = await this.requestRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    r.status = status;
    const saved = await this.requestRepo.save(r);
    await this.notifyDecided(saved);
    return saved;
  }

  issue(id: string) { return this.setStatus(id, 'issued'); }
  reject(id: string) { return this.setStatus(id, 'rejected'); }

  /** Email the submitter a confirmation and alert HR/admin of the new request. Never breaks create(). */
  private async notifySubmitted(request: Request): Promise<void> {
    try {
      if (!request.createdById) return;
      const creator = await this.users.findOne(request.createdById).catch(() => null);
      if (creator?.email) {
        await this.mail.send(
          creator.email,
          'Request submitted',
          `Your ${request.kind} request — "${request.title}" has been submitted and is pending approval.`,
        );
      }

      const approvers = await this.users.findApprovers();
      const who = request.employeeName || creator?.email || 'An employee';
      const approverBody = `${who} raised a new ${request.kind} request — "${request.title}". Review it in the HR dashboard.`;
      await Promise.all(approvers.map((a) => this.mail.send(a.email, 'New request pending approval', approverBody)));
    } catch (err: any) {
      this.logger.error(`Failed to send request-submitted email: ${err?.message}`);
    }
  }

  /** Email the submitter once HR issues/rejects their request. Never breaks issue()/reject(). */
  private async notifyDecided(request: Request): Promise<void> {
    try {
      if (!request.createdById) return;
      const creator = await this.users.findOne(request.createdById).catch(() => null);
      if (!creator?.email) return;
      const verb = request.status === 'issued' ? 'approved' : request.status;
      await this.mail.send(
        creator.email,
        `Request ${verb}`,
        `Your ${request.kind} request — "${request.title}" has been ${verb}.`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to send request-decided email: ${err?.message}`);
    }
  }
}
