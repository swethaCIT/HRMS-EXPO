import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

export enum RegularizationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** Employee-requested correction to a missed/incorrect attendance punch. */
@Entity('regularizations')
export class Regularization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Employee)
  @JoinColumn()
  employee: Employee;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'timestamp', nullable: true })
  requestedCheckIn: Date;

  @Column({ type: 'timestamp', nullable: true })
  requestedCheckOut: Date;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: RegularizationStatus, default: RegularizationStatus.PENDING })
  status: RegularizationStatus;

  @Column({ nullable: true })
  approvedById: string;

  @Column({ type: 'timestamp', nullable: true })
  decidedAt: Date;

  @Column({ type: 'text', nullable: true })
  decisionNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
