import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  HALF_DAY = 'half_day',
  LATE = 'late',
  WORK_FROM_HOME = 'wfh',
}

/**
 * Postgres does not auto-index foreign keys, so without these every
 * `getToday()` (called on every dashboard open) and every history/analytics
 * query was a full sequential scan. The composite (employee, date) index is
 * the one the hot path actually uses.
 */
@Index('idx_attendance_employee_date', ['employee', 'date'])
@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Employee)
  @JoinColumn()
  employee: Employee;

  @Index()
  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkIn: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkOut: Date;

  @Column({ type: 'enum', enum: AttendanceStatus, default: AttendanceStatus.PRESENT })
  status: AttendanceStatus;

  /** Where the punch came from — ready for biometric machine / geofence integration later. */
  @Column({ default: 'manual' })
  source: string; // manual | biometric | geo | system

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
