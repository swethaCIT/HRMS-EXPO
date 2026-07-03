import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { clampPaging } from '../common/utils/pagination';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const employee = this.employeeRepo.create({
      ...dto,
      user: { id: dto.userId } as any,
    });
    return this.employeeRepo.save(employee);
  }

  // The directory is identical for every viewer and changes rarely, so a short
  // cache absorbs the read-heavy list traffic instead of round-tripping the DB
  // on every request. Bounded 15s TTL keeps it fresh enough for a headcount list.
  async findAll(limit?: number, offset?: number): Promise<Employee[]> {
    const { take, skip } = clampPaging(limit, offset);
    const key = `employees:list:${take}:${skip}`;
    const cached = await this.cache.get<Employee[]>(key);
    if (cached) return cached;
    const rows = await this.employeeRepo.find({
      relations: { user: true },
      order: { employeeId: 'ASC' },
      take,
      skip,
    });
    await this.cache.set(key, rows, 15_000);
    return rows;
  }

  async findOne(id: string): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({ where: { id }, relations: { user: true } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    return this.employeeRepo.findOne({ where: { user: { id: userId } }, relations: { user: true } });
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    await this.findOne(id);
    await this.employeeRepo.update(id, dto as any);
    return this.findOne(id);
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<void> {
    await this.employeeRepo.update(id, { avatarUrl });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.employeeRepo.delete(id);
  }
}
