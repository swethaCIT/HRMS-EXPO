import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Generic employee request that HR processes (document/letter, profile change,
 * onboarding step, comp-off, etc.). Mirrors the mobile HRRequest shape.
 */
@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  kind: string; // document | profile | onboarding | leave

  @Column()
  title: string;

  @Column({ nullable: true })
  subtitle: string;

  @Column({ nullable: true })
  meta: string;

  // Nullable as a safety net: the service resolves this from the requester's
  // employee record, but a user with no employee row (e.g. a bare admin
  // account) must not crash the insert with a NOT NULL violation.
  @Column({ nullable: true })
  employeeName: string;

  @Column({ nullable: true })
  employeeId: string;

  @Column({ nullable: true })
  department: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'jsonb', nullable: true })
  detail: { k: string; v: string }[];

  @Column({ default: 'pending' })
  status: string; // pending | issued | rejected

  @Index()
  @Column({ nullable: true })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;
}
