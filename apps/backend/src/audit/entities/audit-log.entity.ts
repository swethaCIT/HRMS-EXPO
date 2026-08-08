import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** What happened. Domain verbs, not HTTP ones — this is read by people. */
export enum AuditAction {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ASSIGNED = 'assigned',
  CANCELLED = 'cancelled',
  ISSUED = 'issued',
  ROLE_CHANGED = 'role_changed',
  ACTIVATED = 'activated',
  DEACTIVATED = 'deactivated',
  LOGIN = 'login',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_RESET = 'password_reset',
  UPLOADED = 'uploaded',
  DOWNLOADED = 'downloaded',
  ACCESS_CHANGED = 'access_changed',
  VIEWED = 'viewed',
}

/**
 * Organisation-wide audit trail — "who did what to whom, and when".
 *
 * Separate from `project_activity`, which is the board's own per-item history.
 * This one covers the HR system: user and employee administration, approvals,
 * payroll runs, document access, sign-ins. Append-only: the application never
 * updates or deletes rows, which is the entire point of an audit log.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ── Who ── */
  @Index()
  @Column({ nullable: true })
  actorId: string;

  @Column({ nullable: true })
  actorName: string;

  @Column({ nullable: true })
  actorRole: string;

  /* ── What ── */
  @Index()
  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  /** Domain noun: user, employee, leave, payroll, ticket, document… */
  @Index()
  @Column()
  entityType: string;

  @Index()
  @Column({ nullable: true })
  entityId: string;

  /** Readable label captured at the time, so history survives renames/deletes. */
  @Column({ nullable: true })
  entityLabel: string;

  /** Who it was done TO, when that differs from the actor (e.g. HR approving someone's leave). */
  @Column({ nullable: true })
  subjectId: string;

  @Column({ nullable: true })
  subjectName: string;

  /** Per-field before/after, same shape as the board's history. */
  @Column({ type: 'simple-json', nullable: true })
  changes: { field: string; from?: string | null; to?: string | null }[];

  /** Pre-rendered one-line summary for the activity feed. */
  @Column({ type: 'text', nullable: true })
  summary: string;

  /* ── Context ── */
  @Column({ nullable: true })
  method: string;

  @Column({ type: 'text', nullable: true })
  path: string;

  @Column({ nullable: true })
  ip: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'int', nullable: true })
  statusCode: number;

  /** False when the attempt was refused (403/401) — failed actions matter most. */
  @Column({ default: true })
  success: boolean;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
