import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  /* ── In-app notifications (DB-backed) ── */
  createForUser(userId: string, title: string, body: string, type: NotificationType = NotificationType.INFO) {
    return this.notificationRepo.save(this.notificationRepo.create({ userId, title, body, type }));
  }

  findForUser(userId: string) {
    return this.notificationRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  unreadCount(userId: string) {
    return this.notificationRepo.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string) {
    await this.notificationRepo.update({ id, userId }, { read: true });
    return { id, read: true };
  }

  async markAllRead(userId: string) {
    await this.notificationRepo.update({ userId, read: false }, { read: true });
    return { success: true };
  }

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    // Firebase is optional — skip initialization (and push notifications) when
    // credentials are not configured, so the API still boots in dev.
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not set — push notifications disabled');
      return;
    }

    if (!getApps().length) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
    this.enabled = true;
    this.logger.log('Firebase Admin initialized');
  }

  async sendToDevice(token: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
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

  async sendToMultiple(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<void> {
    if (!this.enabled || !tokens.length) return;
    try {
      await getMessaging().sendEachForMulticast({ tokens, notification: { title, body }, data });
    } catch (error: any) {
      this.logger.error(`Failed to send multicast notification: ${error.message}`);
    }
  }
}
