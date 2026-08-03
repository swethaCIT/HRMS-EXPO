import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** Azure-style backlog hierarchy: Epic → Feature → User Story → Task / Bug. */
export enum WorkItemType {
  EPIC = 'epic',
  FEATURE = 'feature',
  USER_STORY = 'user_story',
  TASK = 'task',
  BUG = 'bug',
}

/** Azure-style workflow states. */
export enum WorkItemState {
  NEW = 'new',
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  REMOVED = 'removed',
}

/** Which child types a parent may hold — enforced on create/re-parent. */
export const ALLOWED_CHILDREN: Record<WorkItemType, WorkItemType[]> = {
  [WorkItemType.EPIC]: [WorkItemType.FEATURE],
  [WorkItemType.FEATURE]: [WorkItemType.USER_STORY],
  [WorkItemType.USER_STORY]: [WorkItemType.TASK, WorkItemType.BUG],
  [WorkItemType.TASK]: [],
  [WorkItemType.BUG]: [WorkItemType.TASK],
};

@Entity('work_items')
export class WorkItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Per-project running number → displayed as "ATLAS-42". */
  @Column({ type: 'int', default: 1 })
  seq: number;

  @Index()
  @Column()
  projectId: string;

  @Index()
  @Column({ nullable: true })
  sprintId: string;

  @Index()
  @Column({ nullable: true })
  teamId: string;

  /** Parent work item (epic → feature → story → task). Null = top of the tree. */
  @Index()
  @Column({ nullable: true })
  parentId: string;

  @Column({ type: 'enum', enum: WorkItemType })
  type: WorkItemType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: WorkItemState, default: WorkItemState.NEW })
  state: WorkItemState;

  /** Free-text state reason, e.g. "Fixed", "Cannot Reproduce", "Deferred". */
  @Column({ nullable: true })
  reason: string;

  /** 1 = highest … 4 = lowest (Azure convention). */
  @Column({ type: 'int', default: 2 })
  priority: number;

  @Index()
  @Column({ nullable: true })
  assigneeId: string;

  @Column({ nullable: true })
  assigneeName: string;

  /* ── Effort / estimation ── */
  @Column({ type: 'float', default: 0 })
  storyPoints: number;

  @Column({ type: 'float', default: 0 })
  originalEstimate: number; // hours

  @Column({ type: 'float', default: 0 })
  remainingWork: number; // hours

  @Column({ type: 'float', default: 0 })
  completedWork: number; // hours (rolled up from work logs)

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ nullable: true })
  createdById: string;

  @Column({ nullable: true })
  createdByName: string;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  targetDate: Date;

  /* ── State timestamps — power cycle time, burndown and on-time reporting ── */
  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
