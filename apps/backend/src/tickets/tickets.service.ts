import { Injectable, NotFoundException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Ticket } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { clampPaging } from '../common/utils/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly users: UsersService,
  ) {}

  private mineKey(userId: string) {
    return `tickets:mine:${userId}`;
  }

  /**
   * Next display id, derived from the highest existing number rather than
   * `COUNT(*)`. `ticketId` is UNIQUE, and counting collides for two reasons:
   * the seeded rows (TKT-1039, TKT-1043) are not the highest numbers, so the
   * count-based id walks straight into them; and any deletion makes the count
   * go backwards onto an id that already exists. Both surface as a 500 that
   * blocks ticket creation entirely.
   */
  private async nextTicketId(): Promise<string> {
    const rows = await this.ticketRepo.find({ select: { ticketId: true } });
    const highest = rows.reduce((max, r) => {
      const n = parseInt(String(r.ticketId).replace(/^\D+/, ''), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 1000);
    return `TKT-${highest + 1}`;
  }

  async create(dto: CreateTicketDto, userId: string): Promise<Ticket> {
    const ticket = this.ticketRepo.create({
      ...dto,
      priority: dto.priority || 'Medium',
      status: 'Open',
      approval: 'Pending',
      ticketId: await this.nextTicketId(),
      createdById: userId,
    });
    const saved = await this.ticketRepo.save(ticket);
    await this.cache.del(this.mineKey(userId)); // reflect the new ticket immediately
    // Not awaited: see notifyRaised's own comment.
    void this.notifyRaised(saved);
    return saved;
  }

  findAll(limit?: number, offset?: number): Promise<Ticket[]> {
    const { take, skip } = clampPaging(limit, offset);
    return this.ticketRepo.find({
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
  }

  // A user's own ticket list is hit on every dashboard/tickets-tab open. Cache it
  // briefly (10s) per user to keep it off the DB under load; invalidated on create.
  async findMine(userId: string): Promise<Ticket[]> {
    const key = this.mineKey(userId);
    const cached = await this.cache.get<Ticket[]>(key);
    if (cached) return cached;
    const rows = await this.ticketRepo.find({ where: { createdById: userId }, order: { createdAt: 'DESC' } });
    await this.cache.set(key, rows, 10_000);
    return rows;
  }

  private async setApproval(id: string, approval: string, status?: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ticket.approval = approval;
    if (status) ticket.status = status;
    ticket.decidedAt = new Date();
    const saved = await this.ticketRepo.save(ticket);
    if (ticket.createdById) await this.cache.del(this.mineKey(ticket.createdById));
    if (approval === 'Approved') {
      void this.notify(ticket, 'Ticket approved', `Your ticket ${ticket.ticketId} — "${ticket.subject}" has been approved.`);
    } else if (approval === 'Rejected') {
      void this.notify(ticket, 'Ticket rejected', `Your ticket ${ticket.ticketId} — "${ticket.subject}" has been rejected.`);
    }
    return saved;
  }

  approve(id: string) {
    return this.setApproval(id, 'Approved', 'In Progress');
  }

  reject(id: string) {
    return this.setApproval(id, 'Rejected', 'Closed');
  }

  /** Notify the user who created the ticket. Never breaks the approve/reject flow. */
  private async notify(ticket: Ticket, title: string, body: string): Promise<void> {
    try {
      if (!ticket.createdById) return;
      await this.notifications.createForUser(ticket.createdById, title, body, NotificationType.TICKET);
      const creator = await this.users.findOne(ticket.createdById).catch(() => null);
      if (creator?.email) await this.mail.send(creator.email, title, body);
      if (creator?.expoPushToken) await this.notifications.sendToDevice(creator.expoPushToken, title, body, { type: 'ticket', ticketId: ticket.id });
    } catch (err: any) {
      this.logger.error(`Failed to create ticket notification: ${err?.message}`);
    }
  }

  /** Email the submitter a confirmation and alert HR/admin of the new ticket. Never breaks create(). */
  private async notifyRaised(ticket: Ticket): Promise<void> {
    try {
      const creator = await this.users.findOne(ticket.createdById).catch(() => null);
      const applicantSubject = 'Ticket submitted';
      const applicantBody = `Your ticket ${ticket.ticketId} — "${ticket.subject}" has been submitted and is pending approval.`;
      if (creator?.email) await this.mail.send(creator.email, applicantSubject, applicantBody);
      if (creator?.expoPushToken) await this.notifications.sendToDevice(creator.expoPushToken, applicantSubject, applicantBody, { type: 'ticket', ticketId: ticket.id });

      const approvers = await this.users.findApprovers([UserRole.MANAGER, UserRole.HR, UserRole.ADMIN]);
      const approverSubject = 'New ticket pending approval';
      const approverBody = `${creator?.email ?? 'An employee'} raised ticket ${ticket.ticketId} — "${ticket.subject}" (${ticket.priority} priority). Review it in the HR dashboard.`;
      await Promise.all(approvers.map((a) => this.mail.send(a.email, approverSubject, approverBody)));
      const approverTokens = approvers.map((a) => a.expoPushToken).filter((t): t is string => !!t);
      await this.notifications.sendToMultiple(approverTokens, approverSubject, approverBody, { type: 'ticket', ticketId: ticket.id });
    } catch (err: any) {
      this.logger.error(`Failed to send ticket-raised email: ${err?.message}`);
    }
  }

  /**
   * Withdraw a ticket. `actor` is checked against the raiser unless they are
   * manager/HR/Admin — otherwise any employee could close a colleague's open
   * ticket just by knowing its id.
   */
  async cancel(id: string, actor?: { id: string; role?: string }): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const privileged = !!actor?.role && ['admin', 'hr', 'manager'].includes(actor.role);
    if (!privileged && ticket.createdById !== actor?.id) {
      throw new ForbiddenException('You can only cancel a ticket you raised.');
    }
    ticket.status = 'Cancelled';
    const saved = await this.ticketRepo.save(ticket);
    if (ticket.createdById) await this.cache.del(this.mineKey(ticket.createdById));
    return saved;
  }

  async updateStatus(id: string, status: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ticket.status = status;
    const saved = await this.ticketRepo.save(ticket);
    if (ticket.createdById) await this.cache.del(this.mineKey(ticket.createdById));
    return saved;
  }
}
