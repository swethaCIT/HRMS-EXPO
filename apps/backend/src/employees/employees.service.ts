import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const employee = this.employeeRepo.create({
      ...dto,
      user: { id: dto.userId } as any,
    });
    return this.employeeRepo.save(employee);
  }

  async findAll(): Promise<Employee[]> {
    return this.employeeRepo.find({ relations: { user: true } });
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
