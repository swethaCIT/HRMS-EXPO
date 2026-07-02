import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leave, LeaveStatus } from './entities/leave.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
  ) {}

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
    return this.leaveRepo.save(leave);
  }

  async findAll(): Promise<Leave[]> {
    return this.leaveRepo.find({ relations: { employee: true } });
  }

  async findByEmployee(employeeId: string): Promise<Leave[]> {
    return this.leaveRepo.find({ where: { employee: { id: employeeId } } });
  }

  async approve(id: string, approverId: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({ where: { id } });
    if (!leave) throw new NotFoundException('Leave not found');
    leave.status = LeaveStatus.APPROVED;
    leave.approvedById = approverId;
    return this.leaveRepo.save(leave);
  }

  async reject(id: string, reason: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({ where: { id } });
    if (!leave) throw new NotFoundException('Leave not found');
    leave.status = LeaveStatus.REJECTED;
    leave.rejectionReason = reason;
    return this.leaveRepo.save(leave);
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
    return { year, totalRemaining, byType };
  }
}
