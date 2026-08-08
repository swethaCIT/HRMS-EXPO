import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum SprintStatus {
  FUTURE = 'future',
  CURRENT = 'current',
  COMPLETED = 'completed',
}

/** A time-boxed iteration owned by a project (optionally scoped to one team). */
@Entity('project_sprints')
export class Sprint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  projectId: string;

  @Index()
  @Column({ nullable: true })
  teamId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  goal: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'enum', enum: SprintStatus, default: SprintStatus.FUTURE })
  status: SprintStatus;

  /* ── Audit ── */
  @Column({ nullable: true }) createdById: string;
  @Column({ nullable: true }) createdByName: string;
  @Column({ nullable: true }) updatedById: string;
  @Column({ nullable: true }) updatedByName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
