import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { OnboardingToken } from './entities/onboarding-token.entity';

const DEFAULT_EXPIRY_DAYS = 7;

@Injectable()
export class OnboardingTokenService {
  constructor(
    @InjectRepository(OnboardingToken)
    private readonly tokenRepo: Repository<OnboardingToken>,
    private readonly config: ConfigService,
  ) {}

  private secret(): string {
    const secret = this.config.get<string>('ONBOARDING_TOKEN_SECRET') || this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('Neither ONBOARDING_TOKEN_SECRET nor JWT_SECRET is set — cannot sign onboarding links.');
    }
    return secret;
  }

  private expiryDays(): number {
    const days = Number(this.config.get('ONBOARDING_TOKEN_EXPIRY_DAYS'));
    return Number.isFinite(days) && days > 0 ? days : DEFAULT_EXPIRY_DAYS;
  }

  private sign(onboardingId: string, version: number, expiresAtMs: number): string {
    return createHmac('sha256', this.secret()).update(`${onboardingId}.${version}.${expiresAtMs}`).digest('base64url');
  }

  private encode(onboardingId: string, version: number, expiresAtMs: number): string {
    const idPart = Buffer.from(onboardingId, 'utf8').toString('base64url');
    return `${idPart}.${expiresAtMs}.${this.sign(onboardingId, version, expiresAtMs)}`;
  }

  /**
   * Returns the current valid raw link token for this record, creating (or,
   * if expired, extending) its `onboarding_tokens` row as needed. Same DB row
   * state always re-derives the identical raw token until it expires — no
   * new token is minted for a resend or a change-request email.
   */
  async issueOrReuse(onboardingId: string): Promise<string> {
    let row = await this.tokenRepo.findOne({ where: { onboardingId } });
    const now = Date.now();
    if (!row) {
      row = await this.tokenRepo.save(
        this.tokenRepo.create({
          onboardingId,
          version: 1,
          expiresAt: new Date(now + this.expiryDays() * 86_400_000),
        }),
      );
    } else if (row.expiresAt.getTime() <= now) {
      // Expired: extend rather than bump version, so this can't affect a
      // different still-valid, already-issued link for the same record.
      row.expiresAt = new Date(now + this.expiryDays() * 86_400_000);
      row = await this.tokenRepo.save(row);
    }
    return this.encode(onboardingId, row.version, row.expiresAt.getTime());
  }

  /**
   * Verifies a raw link token and resolves it to an onboardingId. Invalid and
   * expired tokens both just resolve to null — the public API must never let
   * an attacker distinguish "wrong" from "expired".
   */
  async resolve(raw: string): Promise<string | null> {
    if (!raw || typeof raw !== 'string') return null;
    const parts = raw.split('.');
    if (parts.length !== 3) return null;
    const [idPart, expPart, sigPart] = parts;

    let onboardingId: string;
    try {
      onboardingId = Buffer.from(idPart, 'base64url').toString('utf8');
    } catch {
      return null;
    }
    const expiresAtMs = Number(expPart);
    if (!onboardingId || !Number.isFinite(expiresAtMs)) return null;

    const row = await this.tokenRepo.findOne({ where: { onboardingId } });
    if (!row) return null;
    // Must match the row's CURRENT expiresAt exactly — a superseded link
    // (from before an expiry-extension) stops working immediately.
    if (row.expiresAt.getTime() !== expiresAtMs) return null;
    if (expiresAtMs <= Date.now()) return null;

    const expected = Buffer.from(this.sign(onboardingId, row.version, expiresAtMs));
    const actual = Buffer.from(sigPart);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    if (!row.usedAt) await this.tokenRepo.update(row.id, { usedAt: new Date() });
    return onboardingId;
  }
}
