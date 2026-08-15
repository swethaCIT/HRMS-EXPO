import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Reusable, DB-backed message bodies for flows that email someone outside the
 * app's own Notification/User model (a candidate with no HRMS account yet).
 * Rendered with `renderTemplate()` (../template.util.ts) against a plain
 * `{{variable}}` syntax — deliberately not a templating engine, since these
 * are short plain-text emails, matching MailService.send()'s plain-text-only
 * contract.
 */
@Entity('notification_templates')
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  key: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
