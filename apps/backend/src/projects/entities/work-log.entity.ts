import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * A time entry against a work item — this is what "how much time did each
 * person put in" in the individual reports is computed from.
 */
@Entity('work_item_logs')
export class WorkLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  workItemId: string;

  @Index()
  @Column()
  projectId: string;

  @Index()
  @Column()
  employeeId: string;

  @Column({ nullable: true })
  employeeName: string;

  @Column({ type: 'float' })
  hours: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
