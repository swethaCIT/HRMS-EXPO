import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from './entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

const MAX_DELIVERY_ATTEMPTS = 3;
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';
// The Expo push API rejects a request with more than 100 messages.
const EXPO_PUSH_CHUNK_SIZE = 100;

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound: 'default';
  priority: 'high';
}

/** Same shape expo-server-sdk uses — tokens look like ExponentPushToken[xxxxxxxx] or ExpoPushToken[xxxxxxxx]. */
function isExpoPushToken(token: string): boolean {
  return (
    typeof token === 'string' &&
    (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) &&
    token.endsWith(']')
  );
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
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
    if (user?.expoPushToken) {
      const data = notification.eventId
        ? { type: 'calendar', eventId: notification.eventId }
        : undefined;
      await this.sendToDevice(
        user.expoPushToken,
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

  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!isExpoPushToken(token)) {
      this.logger.warn(`Ignoring malformed Expo push token: ${token}`);
      return;
    }
    await this.sendChunked([
      { to: token, title, body, data, sound: 'default', priority: 'high' },
    ]);
  }

  async sendToMultiple(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const validTokens = tokens.filter(isExpoPushToken);
    if (!validTokens.length) return;
    await this.sendChunked(
      validTokens.map((to) => ({
        to,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
      })),
    );
  }

  /**
   * POSTs directly to the Expo push API (https://exp.host/--/api/v2/push/send)
   * rather than depending on expo-server-sdk, which ships ESM-only with no
   * CommonJS build — `require()`-ing it crashes this CJS NestJS app at
   * runtime. A plain fetch avoids that module-system mismatch entirely.
   */
  private async sendChunked(messages: ExpoPushMessage[]): Promise<void> {
    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    for (let i = 0; i < messages.length; i += EXPO_PUSH_CHUNK_SIZE) {
      const chunk = messages.slice(i, i + EXPO_PUSH_CHUNK_SIZE);
      try {
        const res = await fetch(EXPO_PUSH_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(chunk),
        });
        if (!res.ok) {
          this.logger.error(
            `Expo push API responded ${res.status}: ${await res.text()}`,
          );
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to send push notification chunk: ${error.message}`,
        );
      }
    }
  }
}
