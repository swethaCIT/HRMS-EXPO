import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERN = 'intern',
}

export enum EmploymentStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  RESIGNED = 'resigned',
  TERMINATED = 'terminated',
}

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  /**
   * Unique + indexed: this is the ordering key of the directory and the
   * idempotency key both seed scripts rely on, but nothing at the database
   * level stopped two rows sharing a code.
   */
  @Index({ unique: true })
  @Column()
  employeeId: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  designation: string;

  @Column({ nullable: true })
  managerId: string;

  @Column({ type: 'date', nullable: true })
  dateOfJoining: Date;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @Column({
    type: 'enum',
    enum: EmploymentStatus,
    default: EmploymentStatus.ACTIVE,
  })
  status: EmploymentStatus;

  @Column({ nullable: true })
  avatarUrl: string;

  /* ── Enterprise HR fields ── */
  @Column({ nullable: true }) grade: string; // band / level, e.g. "L3 · Senior"
  @Column({ nullable: true }) workLocation: string; // e.g. "Bengaluru, IN"
  @Column({ nullable: true }) workMode: string; // Office | Hybrid | Remote
  @Column({ nullable: true }) reportingManager: string; // manager display name

  @Column({ nullable: true }) gender: string;
  @Column({ nullable: true }) bloodGroup: string;
  @Column({ nullable: true }) maritalStatus: string;
  @Column({ nullable: true }) nationality: string;

  @Column({ nullable: true }) personalEmail: string;
  @Column({ nullable: true }) address: string;
  @Column({ nullable: true }) emergencyContactName: string;
  @Column({ nullable: true }) emergencyContactPhone: string;

  // Statutory / payroll (store masked / non-sensitive references)
  @Column({ nullable: true }) pan: string;
  @Column({ nullable: true }) uan: string; // PF universal account no.
  @Column({ nullable: true }) bankName: string;
  @Column({ nullable: true }) bankLast4: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
