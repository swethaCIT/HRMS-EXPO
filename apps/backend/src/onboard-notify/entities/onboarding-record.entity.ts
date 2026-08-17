import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Exclude } from 'class-transformer';

export enum OnboardEmployeeType {
  FRESHER = 'fresher',
  EXPERIENCED = 'experienced',
}

export enum OnboardStatus {
  INVITATION_SENT = 'invitation_sent',
  LINK_OPENED = 'link_opened',
  FORM_IN_PROGRESS = 'form_in_progress',
  SUBMITTED = 'submitted',
  HR_REVIEW = 'hr_review',
  CHANGES_REQUESTED = 'changes_requested',
  APPROVED = 'approved',
  FORWARDED = 'forwarded',
  COMPLETED = 'completed',
}

/**
 * A pre-onboarding candidate record — created by HR before the person has any
 * HRMS account. Deliberately separate from `OnboardingInvite` (see
 * ../../onboarding/entities/onboarding-invite.entity.ts), which is a different,
 * simpler self-registration flow (typed OTP, provisions a User immediately).
 * This one collects a full onboarding form over a scoped login session and
 * never creates a User/Employee itself — see EmployeesService.create().
 *
 * The candidate signs in with `loginId`/`passwordHash` (see
 * OnboardingAuthService), NOT a real HRMS `User` row — a real User with
 * UserRole.EMPLOYEE would grant genuine access to leave/payroll/tickets/etc.,
 * which a pre-hire candidate must never have. OnboardingSessionGuard scopes a
 * session strictly to this one record.
 */
@Entity('onboarding_records')
export class OnboardingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-friendly reference safe to show in UI/emails — never the secret token. */
  @Index({ unique: true })
  @Column()
  onboardingRef: string;

  @Column()
  tempName: string;

  @Column()
  mobile: string;

  /** Candidate's personal email — where the secure onboarding link is sent. */
  @Index()
  @Column()
  email: string;

  @Column({ type: 'enum', enum: OnboardEmployeeType })
  employeeType: OnboardEmployeeType;

  @Column({ type: 'date', nullable: true })
  expectedJoiningDate: Date | null;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  designation: string;

  // Bare uuid reference to employees.id, not a TypeORM relation — matches the
  // existing Employee.managerId convention (employees/entities/employee.entity.ts),
  // which this codebase never enforces as a real FK either.
  @Column({ nullable: true })
  reportingManagerId: string;

  @Index()
  @Column({ type: 'enum', enum: OnboardStatus, default: OnboardStatus.INVITATION_SENT })
  status: OnboardStatus;

  @Index()
  @Column()
  createdById: string;

  /* ── Portal credentials — scoped to this record only, never a real User ── */

  /** Currently always equal to `onboardingRef`, kept as its own column since the two concepts (display reference vs. login identity) may diverge later. */
  @Index({ unique: true })
  @Column()
  loginId: string;

  @Column()
  @Exclude()
  passwordHash: string;

  /** Cleared the moment the candidate sets their own password — see OnboardingSessionGuard, which re-checks this live rather than trusting a stale JWT claim. */
  @Column({ default: true })
  mustChangePassword: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
