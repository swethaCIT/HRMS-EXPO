import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Ticket } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { clampPaging } from '../common/utils/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly notifications: NotificationsService,
  ) {}

  private mineKey(userId: string) {
    return `tickets:mine:${userId}`;
  }

  async create(dto: CreateTicketDto, userId: string): Promise<Ticket> {
    const count = await this.ticketRepo.count();
    const ticket = this.ticketRepo.create({
      ...dto,
      priority: dto.priority || 'Medium',
      status: 'Open',
      approval: 'Pending',
      ticketId: `TKT-${1000 + count + 1}`,
      createdById: userId,
    });
    const saved = await this.ticketRepo.save(ticket);
    await this.cache.del(this.mineKey(userId)); // reflect the new ticket immediately
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
      await this.notify(ticket, 'Ticket approved', `Your ticket ${ticket.ticketId} — "${ticket.subject}" has been approved.`);
    } else if (approval === 'Rejected') {
      await this.notify(ticket, 'Ticket rejected', `Your ticket ${ticket.ticketId} — "${ticket.subject}" has been rejected.`);
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
    } catch (err: any) {
      this.logger.error(`Failed to create ticket notification: ${err?.message}`);
    }
  }

  async cancel(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
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
