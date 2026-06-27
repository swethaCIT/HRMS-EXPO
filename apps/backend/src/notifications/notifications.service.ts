import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: this.config.get<string>('FIREBASE_PROJECT_ID'),
          clientEmail: this.config.get<string>('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log('Firebase Admin initialized');
    }
  }

  async sendToDevice(token: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
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
    if (!tokens.length) return;
    try {
      await getMessaging().sendEachForMulticast({ tokens, notification: { title, body }, data });
    } catch (error: any) {
      this.logger.error(`Failed to send multicast notification: ${error.message}`);
    }
  }
}
