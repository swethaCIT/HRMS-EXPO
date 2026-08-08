import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserRole } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Public self-registration. The role is FORCED to `employee` and never taken
   * from the request body: this endpoint is unauthenticated, so honouring a
   * caller-supplied role would let anyone mint themselves an admin account.
   * Privileged accounts are created only via the admin-guarded `POST /users`.
   */
  async register(dto: CreateUserDto) {
    const user = await this.usersService.create({ ...dto, role: UserRole.EMPLOYEE });
    return this.signToken(user.id, user.email);
  }

  /**
   * `ctx` carries request metadata for the audit trail. Failed attempts are
   * recorded too — a burst of them against one account is the signal you
   * actually want, and it never reaches any other logging path.
   */
  async login(dto: LoginDto, ctx?: { ip?: string; userAgent?: string }) {
    const fail = (reason: string) => {
      void this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        entityType: 'auth',
        entityLabel: dto.email,
        actor: { name: dto.email },
        summary: `Failed sign-in for ${dto.email} — ${reason}`,
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
        success: false,
      });
    };

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      fail('no such account');
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      fail('account disabled');
      throw new UnauthorizedException('Account is disabled');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      fail('wrong password');
      throw new UnauthorizedException('Invalid credentials');
    }

    void this.audit.record({
      action: AuditAction.LOGIN,
      entityType: 'auth',
      entityId: user.id,
      entityLabel: user.email,
      actor: { id: user.id, name: user.email.split('@')[0], role: user.role },
      summary: `${user.email} signed in`,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    return this.signToken(user.id, user.email);
  }

  /* ── Forgot / reset password ── */

  /** Wrong-code attempts allowed before the reset token is burned. */
  private static readonly MAX_OTP_ATTEMPTS = 5;

  private genOtp(): string {
    // crypto.randomInt, not Math.random: V8's PRNG is not cryptographic and its
    // internal state can be recovered from observed outputs, so an attacker who
    // can trigger and read their own OTPs could predict someone else's.
    return String(randomInt(100000, 1000000));
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Returning the OTP in the HTTP response is an account-takeover primitive,
    // so it requires an explicit opt-in rather than merely "NODE_ENV isn't
    // production" — a plain `node dist/main` with no env set would otherwise
    // expose it. Set EXPOSE_DEV_OTP=true locally when there's no mail provider.
    const isDev =
      this.config.get('NODE_ENV') !== 'production' && this.config.get('EXPOSE_DEV_OTP') === 'true';
    // Always return success (don't reveal whether the email exists).
    if (!user) return { sent: true };

    const otp = this.genOtp();
    const hash = await bcrypt.hash(otp, 10);
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await this.usersService.setResetToken(user.id, hash, expires);
    await this.mail.send(
      email,
      'Your HRMS password reset code',
      `Your password reset code is ${otp}. It expires in 15 minutes. If you didn't request this, ignore this email.`,
    );
    // In dev (no mail provider), surface the OTP so the flow is testable.
    return isDev ? { sent: true, devOtp: otp } : { sent: true };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.resetTokenHash || !user.resetTokenExpires) {
      throw new BadRequestException('Invalid or expired reset code');
    }
    if (new Date(user.resetTokenExpires).getTime() < Date.now()) {
      throw new BadRequestException('Reset code has expired');
    }

    const valid = await bcrypt.compare(otp, user.resetTokenHash);
    if (!valid) {
      // Without a counter the 6-digit code stayed guessable for the full 15
      // minutes, and the global 300 req/min throttle is per-IP — trivially
      // sidestepped. Burn the token after a handful of wrong guesses.
      const attempts = (user.resetAttempts ?? 0) + 1;
      if (attempts >= AuthService.MAX_OTP_ATTEMPTS) {
        await this.usersService.clearResetToken(user.id);
        throw new BadRequestException('Too many incorrect codes. Request a new reset code.');
      }
      await this.usersService.setResetAttempts(user.id, attempts);
      throw new BadRequestException(
        `Invalid reset code. ${AuthService.MAX_OTP_ATTEMPTS - attempts} attempt(s) remaining.`,
      );
    }

    await this.usersService.setPassword(user.id, newPassword);
    // One-time use: clear the token so the same code can't be replayed.
    await this.usersService.clearResetToken(user.id);
    return { success: true };
  }

  private signToken(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: userId, email },
    };
  }
}
