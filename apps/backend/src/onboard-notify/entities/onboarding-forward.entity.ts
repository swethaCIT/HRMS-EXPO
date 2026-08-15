import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum OnboardDepartment {
  PAYROLL = 'payroll',
  IT = 'it',
  ADMIN = 'admin',
  MANAGER = 'manager',
}

export enum OnboardForwardStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

/**
 * One row per department HR forwards an approved onboarding record to.
 * `fieldsShared` is the exact, HR-picked subset of field keys that recipient
 * is allowed to see (see onboarding-field-catalog.ts) — nothing is derived or
 * defaulted server-side, so a department HR never selected gets no row at all.
 */
@Entity('onboarding_forwards')
export class OnboardingForward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  onboardingId: string;

  @Column({ type: 'enum', enum: OnboardDepartment })
  department: OnboardDepartment;

  /** Internal HRMS user who receives the filtered notification (NotificationsService is keyed by userId). */
  @Column()
  recipientUserId: string;

  @Column({ type: 'jsonb' })
  fieldsShared: string[];

  @Column({ type: 'uuid', nullable: true })
  notificationId: string | null;

  @Column({ type: 'enum', enum: OnboardForwardStatus, default: OnboardForwardStatus.PENDING })
  status: OnboardForwardStatus;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
