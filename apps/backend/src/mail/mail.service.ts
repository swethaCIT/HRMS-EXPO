import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Sends transactional email (onboarding invites, password-reset OTPs, notifications).
 * - If SMTP/Gmail credentials are configured, sends real email.
 * - Otherwise runs in DEV mode: logs the message to the console (nothing is lost),
 *   so the flows are fully testable without a mail provider. Add credentials to go live.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;
  readonly live: boolean;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER') || config.get<string>('GMAIL_USER');
    const pass = config.get<string>('SMTP_PASS') || config.get<string>('GMAIL_APP_PASSWORD');
    this.from = config.get<string>('MAIL_FROM') || user || 'no-reply@hrms.app';

    if (user && pass) {
      this.transporter = host
        ? nodemailer.createTransport({ host, port: config.get<number>('SMTP_PORT', 587), secure: false, auth: { user, pass } })
        : nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }); // Gmail App Password
      this.live = true;
      this.logger.log(`Mail configured (${host || 'gmail'})`);
    } else {
      this.live = false;
      this.logger.warn('Mail not configured — running in DEV mode (emails are logged, not sent)');
    }
  }

  async send(to: string, subject: string, body: string): Promise<{ delivered: boolean }> {
    if (!this.transporter) {
      this.logger.warn(`\n────── DEV EMAIL ──────\nTo: ${to}\nSubject: ${subject}\n${body}\n───────────────────────`);
      return { delivered: false };
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text: body });
      return { delivered: true };
    } catch (e: any) {
      this.logger.error(`Email to ${to} failed: ${e.message}`);
      return { delivered: false };
    }
  }
}
