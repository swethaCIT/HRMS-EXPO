import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ProjectStatus {
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
}

/**
 * A delivery project ("Goal") — the top of the board hierarchy:
 * Project → Team → Sprint → Epic → Feature → User Story → Task/Bug.
 * Created by a manager (or HR/Admin); everyone in the org can read it.
 */
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Short code shown on work-item cards, e.g. ATLAS → "ATLAS-42". */
  @Index()
  @Column()
  key: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  status: ProjectStatus;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  targetDate: Date;

  /** Accent colour for the project card / avatar. */
  @Column({ nullable: true })
  color: string;

  /** The manager who created (and owns) the project. */
  @Column({ nullable: true })
  ownerId: string;

  @Column({ nullable: true })
  ownerName: string;

  /** Who last edited the project header. */
  @Column({ nullable: true })
  updatedById: string;

  @Column({ nullable: true })
  updatedByName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
