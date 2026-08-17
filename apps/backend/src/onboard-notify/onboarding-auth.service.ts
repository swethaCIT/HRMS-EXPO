import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { OnboardingRecord } from './entities/onboarding-record.entity';

export interface OnboardingSessionPayload {
  sub: string; // onboarding_records.id
  scope: 'onboarding-portal';
  mustChangePassword: boolean;
}

// No 0/O/1/I/l — a candidate is reading this off an email on a phone.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * Authenticates onboarding candidates against `OnboardingRecord.loginId`/
 * `passwordHash` — a separate, narrowly-scoped identity from the main HRMS
 * `User` table (see the entity's class doc). Sessions are signed with a
 * dedicated `JwtModule` instance registered in OnboardNotifyModule (mirroring
 * how onboarding.module.ts and auth.module.ts each keep their own), using
 * ONBOARDING_TOKEN_SECRET so a leaked portal session can never be replayed
 * against the main API and vice versa.
 */
@Injectable()
export class OnboardingAuthService {
  constructor(
    @InjectRepository(OnboardingRecord)
    private readonly recordRepo: Repository<OnboardingRecord>,
    private readonly jwt: JwtService,
  ) {}

  generateTempPassword(length = 12): string {
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) out += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
    return out;
  }

  hashPassword(raw: string): Promise<string> {
    return bcrypt.hash(raw, 10);
  }

  private issueSession(record: Pick<OnboardingRecord, 'id' | 'mustChangePassword'>): string {
    const payload: OnboardingSessionPayload = { sub: record.id, scope: 'onboarding-portal', mustChangePassword: record.mustChangePassword };
    return this.jwt.sign(payload);
  }

  verifySession(token: string): OnboardingSessionPayload {
    let payload: OnboardingSessionPayload;
    try {
      payload = this.jwt.verify<OnboardingSessionPayload>(token);
    } catch {
      throw new UnauthorizedException('Your session has expired — please log in again.');
    }
    if (payload.scope !== 'onboarding-portal') throw new UnauthorizedException('Invalid session.');
    return payload;
  }

  async login(loginId: string, password: string): Promise<{ record: OnboardingRecord; token: string }> {
    const record = await this.recordRepo.findOne({ where: { loginId } });
    // Identical error whether the login ID is unknown or the password is
    // wrong — telling them apart would let an attacker enumerate valid IDs.
    if (!record || !(await bcrypt.compare(password, record.passwordHash))) {
      throw new UnauthorizedException('Invalid login ID or password.');
    }
    await this.recordRepo.update(record.id, { lastLoginAt: new Date() });
    return { record, token: this.issueSession(record) };
  }

  async changePassword(record: OnboardingRecord, currentPassword: string, newPassword: string): Promise<string> {
    if (!(await bcrypt.compare(currentPassword, record.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters.');
    if (await bcrypt.compare(newPassword, record.passwordHash)) {
      throw new BadRequestException('New password must be different from the current password.');
    }
    const passwordHash = await this.hashPassword(newPassword);
    await this.recordRepo.update(record.id, { passwordHash, mustChangePassword: false });
    return this.issueSession({ id: record.id, mustChangePassword: false });
  }

  /** Used by HR's "resend" — a fresh temp password, same login ID, same record. Never provisions a second account. */
  async resetTempPassword(record: OnboardingRecord): Promise<string> {
    const tempPassword = this.generateTempPassword();
    const passwordHash = await this.hashPassword(tempPassword);
    await this.recordRepo.update(record.id, { passwordHash, mustChangePassword: true });
    return tempPassword;
  }
}
