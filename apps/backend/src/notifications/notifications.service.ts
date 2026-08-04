import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from './entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

const MAX_DELIVERY_ATTEMPTS = 3;

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private enabled = false;
  private retrying = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly mail: MailService,
    private readonly users: UsersService,
  ) {}

  /* ── In-app notifications (DB-backed) ── */
  createForUser(
    userId: string,
    title: string,
    body: string,
    type: NotificationType = NotificationType.INFO,
  ) {
    return this.notificationRepo.save(
      this.notificationRepo.create({ userId, title, body, type }),
    );
  }

  findForUser(userId: string) {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  unreadCount(userId: string) {
    return this.notificationRepo.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string) {
    await this.notificationRepo.update(
      { id, userId },
      { read: true, readAt: new Date() },
    );
    return { id, read: true };
  }

  async markAllRead(userId: string) {
    await this.notificationRepo.update(
      { userId, read: false },
      { read: true, readAt: new Date() },
    );
    return { success: true };
  }

  /**
   * Creates a notification row awaiting delivery (email/push) rather than
   * treating the DB write as delivery itself — used by flows (calendar
   * invites/updates/cancellations/reminders) that need real delivery status
   * to drive the retry job. Pair with `dispatch()`.
   */
  createPendingForUser(
    userId: string,
    title: string,
    body: string,
    type: NotificationType,
    opts?: { eventId?: string; occurrenceAt?: Date },
  ) {
    return this.notificationRepo.save(
      this.notificationRepo.create({
        userId,
        title,
        body,
        type,
        status: NotificationStatus.PENDING,
        eventId: opts?.eventId ?? null,
        occurrenceAt: opts?.occurrenceAt ?? null,
      }),
    );
  }

  /** True once a Reminder notification already exists for this occurrence — used to avoid re-sending on every scan pass. */
  async reminderAlreadySent(
    userId: string,
    eventId: string,
    occurrenceAt: Date,
  ): Promise<boolean> {
    const count = await this.notificationRepo.count({
      where: {
        userId,
        eventId,
        occurrenceAt,
        type: NotificationType.CALENDAR_REMINDER,
      },
    });
    return count > 0;
  }

  /**
   * Attempts email + push delivery for a PENDING/FAILED notification and
   * records the outcome. Success is judged by email delivery (push is
   * best-effort and already never throws) — this is what the retry job
   * re-evaluates on later attempts.
   */
  async dispatch(notification: Notification): Promise<void> {
    const user = await this.users
      .findOne(notification.userId)
      .catch(() => null);
    notification.attempts += 1;

    let delivered = false;
    if (user?.email) {
      const result = await this.mail.send(
        user.email,
        notification.title,
        notification.body,
      );
      delivered = result.delivered;
    }
    if (user?.fcmToken) {
      const data = notification.eventId
        ? { type: 'calendar', eventId: notification.eventId }
        : undefined;
      await this.sendToDevice(
        user.fcmToken,
        notification.title,
        notification.body,
        data,
      );
    }

    notification.status = delivered
      ? NotificationStatus.SENT
      : NotificationStatus.FAILED;
    notification.sentAt = delivered ? new Date() : notification.sentAt;
    await this.notificationRepo.save(notification);
  }

  /** Retries FAILED deliveries up to MAX_DELIVERY_ATTEMPTS total, then leaves them FAILED. Guarded against overlapping runs. */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailedNotifications(): Promise<void> {
    if (this.retrying) return;
    this.retrying = true;
    try {
      const failed = await this.notificationRepo.find({
        where: {
          status: NotificationStatus.FAILED,
          attempts: LessThan(MAX_DELIVERY_ATTEMPTS),
        },
        take: 200,
      });
      for (const notification of failed) {
        await this.dispatch(notification).catch((err: any) =>
          this.logger.error(
            `Retry dispatch failed for notification ${notification.id}: ${err?.message}`,
          ),
        );
      }
    } catch (err: any) {
      this.logger.error(`Notification retry scan failed: ${err?.message}`);
    } finally {
      this.retrying = false;
    }
  }

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    // Firebase is optional — skip initialization (and push notifications) when
    // credentials are not configured, so the API still boots in dev.
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials not set — push notifications disabled',
      );
      return;
    }

    if (!getApps().length) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    }
    this.enabled = true;
    this.logger.log('Firebase Admin initialized');
  }

  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.enabled) return;
    try {
      await getMessaging().send({
        token,
        notification: { title, body },
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch (error: any) {
      this.logger.error(`Failed to send notification: ${error.message}`);
    }
  }

  async sendToMultiple(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.enabled || !tokens.length) return;
    try {
      await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to send multicast notification: ${error.message}`,
      );
    }
  }
}
