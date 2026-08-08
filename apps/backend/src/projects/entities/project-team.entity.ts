import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * What a member may do inside their team. The team's manager grants this —
 * it's the "manager gives access to the people" control.
 *   read       — see the team's board and reports, change nothing
 *   contribute — create/edit/move work items and log time (the default)
 *   manage     — the above, plus manage the roster, access and sprints
 */
export enum TeamAccessLevel {
  READ = 'read',
  CONTRIBUTE = 'contribute',
  MANAGE = 'manage',
}

/**
 * A squad inside a project. Each team has its own manager, its own members and
 * its own sprint burndown — mirroring an Azure Boards "team" under a project.
 */
@Entity('project_teams')
export class ProjectTeam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  projectId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** Employee id of the team's manager (denormalised name for cheap listing). */
  @Column({ nullable: true })
  managerEmployeeId: string;

  @Column({ nullable: true })
  managerName: string;

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

@Entity('project_team_members')
export class ProjectTeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  teamId: string;

  @Index()
  @Column()
  projectId: string;

  @Column()
  employeeId: string;

  @Column()
  name: string;

  /** Role on the squad — Developer, QA, Designer, Tech Lead… */
  @Column({ nullable: true })
  role: string;

  /** What this member is allowed to do — granted by the team's manager. */
  @Column({ type: 'enum', enum: TeamAccessLevel, default: TeamAccessLevel.CONTRIBUTE })
  accessLevel: TeamAccessLevel;

  /** Planning capacity used by the sprint capacity bar. */
  @Column({ type: 'float', default: 8 })
  capacityHoursPerDay: number;

  /* ── Audit ── */
  @Column({ nullable: true }) addedById: string;
  @Column({ nullable: true }) addedByName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
