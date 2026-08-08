import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payroll, PayrollStatus } from './entities/payroll.entity';
import { clampPaging } from '../common/utils/pagination';

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(Payroll)
    private readonly payrollRepo: Repository<Payroll>,
  ) {}

  async generate(employeeId: string, month: number, year: number, basicSalary: number): Promise<Payroll> {
    const allowances = basicSalary * 0.2;
    const deductions = basicSalary * 0.05;
    const tax = (basicSalary + allowances - deductions) * 0.1;
    const netSalary = basicSalary + allowances - deductions - tax;

    const payroll = this.payrollRepo.create({
      employee: { id: employeeId } as any,
      month,
      year,
      basicSalary,
      allowances,
      deductions,
      tax,
      netSalary,
    });
    return this.payrollRepo.save(payroll);
  }

  async findByEmployee(employeeId: string): Promise<Payroll[]> {
    return this.payrollRepo.find({
      where: { employee: { id: employeeId } },
      order: { year: 'DESC', month: 'DESC' },
    });
  }

  /** Org-wide payroll, bounded — grows by headcount × 12 every year. */
  async findAll(limit?: number, offset?: number): Promise<Payroll[]> {
    const { take, skip } = clampPaging(limit, offset);
    return this.payrollRepo.find({
      relations: { employee: true },
      order: { year: 'DESC', month: 'DESC' },
      take,
      skip,
    });
  }

  async markAsPaid(id: string): Promise<Payroll> {
    const payroll = await this.payrollRepo.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException('Payroll not found');
    payroll.status = PayrollStatus.PAID;
    payroll.paymentDate = new Date();
    return this.payrollRepo.save(payroll);
  }
}
