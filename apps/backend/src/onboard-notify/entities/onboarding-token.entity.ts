import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * One row per onboarding record (not one per issuance). Deliberately holds no
 * secret at all — not even a hash — because the raw link token is a
 * deterministic HMAC over (onboardingId, version, expiresAt) signed with a
 * server-side secret (see OnboardingTokenService). That lets HR "resend" or
 * send the change-request email with the EXACT SAME link the candidate
 * already has, without ever having stored it — a hash-at-rest scheme can
 * verify a token but can never reproduce it for re-sending, which the
 * change-request flow requires ("same onboarding link... must continue to
 * work" — the token isn't reissued for every correction cycle).
 *
 * `version` exists purely so a token could be forcibly invalidated (e.g. a
 * security incident) by bumping it, without touching `expiresAt` semantics.
 */
@Entity('onboarding_tokens')
export class OnboardingToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  onboardingId: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  /**
   * First successful validation time. Informational only — per the
   * change-request flow, the same link keeps working across every
   * edit/resubmit round-trip, so this never gates access.
   */
  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
