import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum MeetingMode {
  ONLINE = 'Online',
  OFFLINE = 'Offline',
  HYBRID = 'Hybrid',
}

export enum RecurrenceType {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum EventStatus {
  SCHEDULED = 'SCHEDULED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Entity('calendar_events')
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  eventId: string;

  @Column({ length: 100 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  // The organizing employee — auto-added as a participant and the only one
  // who may edit/cancel (enforced separately via createdById, the acting user).
  @Index()
  @Column({ type: 'uuid' })
  organizerId: string;

  @Index()
  @Column({ type: 'timestamp' })
  startDateTime: Date;

  @Index()
  @Column({ type: 'timestamp' })
  endDateTime: Date;

  @Column({ type: 'enum', enum: MeetingMode })
  meetingMode: MeetingMode;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'varchar', nullable: true })
  meetingLink: string | null;

  @Column({ type: 'enum', enum: RecurrenceType, default: RecurrenceType.NONE })
  recurrenceType: RecurrenceType;

  @Column({ type: 'date', nullable: true })
  recurrenceEndDate: Date | null;

  // Soft-delete flag: cancel() sets this to CANCELLED rather than removing the row.
  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.SCHEDULED })
  status: EventStatus;

  @Column({ type: 'uuid' })
  createdById: string;

  @Column({ type: 'uuid', nullable: true })
  updatedById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
