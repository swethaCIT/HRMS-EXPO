import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** What happened. Mirrors the Azure Boards "History" tab vocabulary. */
export enum ActivityAction {
  CREATED = 'created',
  UPDATED = 'updated',
  STATE_CHANGED = 'state_changed',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  DELETED = 'deleted',
  WORK_LOGGED = 'work_logged',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed',
  ACCESS_CHANGED = 'access_changed',
  SPRINT_CHANGED = 'sprint_changed',
}

/** Which record the activity is about. */
export enum ActivityEntity {
  PROJECT = 'project',
  TEAM = 'team',
  SPRINT = 'sprint',
  WORK_ITEM = 'work_item',
}

/**
 * Append-only audit trail for everything that happens on a board: who did it,
 * what changed (old → new, per field) and when. Rows are never updated or
 * deleted by the app, so the history stays trustworthy.
 */
@Entity('project_activity')
export class ProjectActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  projectId: string;

  @Column({ type: 'enum', enum: ActivityEntity })
  entityType: ActivityEntity;

  /** Id of the work item / team / sprint / project the entry describes. */
  @Index()
  @Column()
  entityId: string;

  /** Human label of that record at the time, so history survives renames/deletes. */
  @Column({ nullable: true })
  entityTitle: string;

  @Column({ type: 'enum', enum: ActivityAction })
  action: ActivityAction;

  /** The user who performed it — the audit's "who". */
  @Column({ nullable: true })
  actorId: string;

  @Column({ nullable: true })
  actorName: string;

  /**
   * Per-field before/after pairs, e.g.
   * `[{ field: 'state', from: 'new', to: 'active' }]`.
   * Stored as JSON so a single row can describe a multi-field edit.
   */
  @Column({ type: 'simple-json', nullable: true })
  changes: { field: string; from?: string | null; to?: string | null }[];

  /** Pre-rendered one-line summary for the history feed. */
  @Column({ type: 'text', nullable: true })
  summary: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
