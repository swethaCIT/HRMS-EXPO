import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

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

  @CreateDateColumn()
  createdAt: Date;
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

  /** Planning capacity used by the sprint capacity bar. */
  @Column({ type: 'float', default: 8 })
  capacityHoursPerDay: number;

  @CreateDateColumn()
  createdAt: Date;
}
