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
  WORK_ITEM = 'work_item',
  // HR Onboard Notify. There is no ONBOARD_CHANGES_REQUESTED type here — that
  // step notifies the onboarding candidate, who has no `userId`/User row to
  // attach a Notification to. It's delivered as a direct email instead (see
  // OnboardNotifyService), via the same NotificationTemplate the invite uses.
  ONBOARD_SUBMITTED = 'onboard_submitted',
  ONBOARD_ROUTED = 'onboard_routed',
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
  // Scanned by the retry cron every 60s — unindexed this is a full table scan
  // of every notification ever sent, forever.
  @Index()
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
