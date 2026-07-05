import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from './entities/request.entity';
import { EmployeesService } from '../employees/employees.service';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    private readonly employeesService: EmployeesService,
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
    return this.requestRepo.save(this.requestRepo.create({
      ...data,
      employeeName: employeeName ?? data.employeeName,
      employeeId: employee?.employeeId ?? data.employeeId,
      department: employee?.department ?? data.department,
      createdById: userId,
      status: 'pending',
    }));
  }

  private async setStatus(id: string, status: string): Promise<Request> {
    const r = await this.requestRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    r.status = status;
    return this.requestRepo.save(r);
  }

  issue(id: string) { return this.setStatus(id, 'issued'); }
  reject(id: string) { return this.setStatus(id, 'rejected'); }
}
