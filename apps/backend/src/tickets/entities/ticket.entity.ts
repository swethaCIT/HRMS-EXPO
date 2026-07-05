import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Columns store the same display strings the mobile app uses
 * (e.g. status "Open", priority "High", approval "Pending") to avoid mapping.
 */
@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  ticketId: string; // human code e.g. TKT-1043

  @Column()
  subject: string;

  @Column()
  dept: string;

  @Column()
  category: string;

  @Column()
  subCategory: string;

  @Column({ default: 'Medium' })
  priority: string; // Low | Medium | High | Critical

  @Column({ default: 'Open' })
  status: string; // Open | In Progress | Resolved | Closed

  @Column({ default: 'Pending' })
  approval: string; // Pending | Approved | Rejected

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  agent: string;

  @Index()
  @Column()
  createdById: string;

  @Column({ nullable: true })
  approvedById: string;

  @Column({ type: 'timestamp', nullable: true })
  decidedAt: Date;

  @Column({ type: 'text', nullable: true })
  decisionNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
