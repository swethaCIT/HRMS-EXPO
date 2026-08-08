import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

export enum PayrollStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  PAID = 'paid',
}

/**
 * One payslip per employee per month. Without this constraint, calling
 * `POST /payroll/generate` twice silently created a duplicate payslip and every
 * downstream total (and the employee's own history) doubled.
 */
@Unique('uq_payroll_employee_period', ['employee', 'month', 'year'])
@Entity('payrolls')
export class Payroll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Employee)
  @JoinColumn()
  employee: Employee;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basicSalary: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  allowances: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deductions: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  netSalary: number;

  @Column({ type: 'enum', enum: PayrollStatus, default: PayrollStatus.PENDING })
  status: PayrollStatus;

  @Column({ nullable: true })
  paymentDate: Date;

  @CreateDateColumn()
  createdAt: Date;
}
