import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('onboarding_invites')
export class OnboardingInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tempEmployeeId: string; // e.g. ONB-4821 (temporary until provisioned)

  @Index()
  @Column()
  personalEmail: string;

  @Column()
  @Exclude()
  tokenHash: string; // bcrypt hash of the one-time invite code

  // Pre-filled by HR (optional)
  @Column({ nullable: true }) firstName: string;
  @Column({ nullable: true }) lastName: string;
  @Column({ nullable: true }) department: string;
  @Column({ nullable: true }) designation: string;

  @Column({ default: 'sent' })
  status: string; // sent | completed | expired

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ nullable: true })
  createdById: string; // HR/admin who sent the invite

  // Filled on completion
  @Column({ nullable: true }) provisionedEmail: string;
  @Column({ nullable: true }) provisionedEmployeeId: string;

  @CreateDateColumn()
  createdAt: Date;
}
