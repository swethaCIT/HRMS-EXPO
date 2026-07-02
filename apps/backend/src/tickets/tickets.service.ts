import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { clampPaging } from '../common/utils/pagination';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

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
    return this.ticketRepo.save(ticket);
  }

  findAll(limit?: number, offset?: number): Promise<Ticket[]> {
    const { take, skip } = clampPaging(limit, offset);
    return this.ticketRepo.find({
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
  }

  findMine(userId: string): Promise<Ticket[]> {
    return this.ticketRepo.find({ where: { createdById: userId }, order: { createdAt: 'DESC' } });
  }

  private async setApproval(id: string, approval: string, status?: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ticket.approval = approval;
    if (status) ticket.status = status;
    return this.ticketRepo.save(ticket);
  }

  approve(id: string) {
    return this.setApproval(id, 'Approved', 'In Progress');
  }

  reject(id: string) {
    return this.setApproval(id, 'Rejected', 'Closed');
  }

  async updateStatus(id: string, status: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ticket.status = status;
    return this.ticketRepo.save(ticket);
  }
}
