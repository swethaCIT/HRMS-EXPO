import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  INFO = 'info',
  APPROVAL = 'approval',
  LEAVE = 'leave',
  PAYROLL = 'payroll',
  TICKET = 'ticket',
  SYSTEM = 'system',
  CALENDAR_INVITE = 'calendar_invite',
  CALENDAR_UPDATE = 'calendar_update',
  CALENDAR_CANCEL = 'calendar_cancel',
  CALENDAR_REMINDER = 'calendar_reminder',
}

// Delivery status of the notification itself (email/push), independent of
// whether the recipient has read it in-app (see `read` below).
export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Recipient user id (kept as a plain column for simple per-user querying).
  @Index()
  @Column()
  userId: string;

  @Column()
  title: string;

  @Column()
  body: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type: NotificationType;

  @Column({ default: false })
  read: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  // Existing callers (tickets/requests/etc.) create+deliver in one inline step and
  // never re-check delivery, so they default to SENT. Only flows that dispatch
  // through `createPendingForUser`/`dispatch` (calendar invites/reminders) start
  // at PENDING and can end up FAILED for the retry job to pick up.
  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.SENT,
  })
  status: NotificationStatus;

  @Column({ default: 0 })
  attempts: number;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  // The specific occurrence (of a recurring calendar event) this notification
  // pertains to — lets the reminder job dedupe per-occurrence instead of
  // per-event, since a recurring series produces a fresh reminder every time.
  @Column({ type: 'timestamp', nullable: true })
  occurrenceAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
