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
}
