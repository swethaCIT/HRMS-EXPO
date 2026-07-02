import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return this.signToken(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.signToken(user.id, user.email);
  }

  /* ── Forgot / reset password ── */
  private genOtp(): string {
    // 6-digit numeric OTP (avoids Math.random determinism concerns — fine at runtime)
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    const isDev = this.config.get('NODE_ENV') !== 'production';
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
    if (!valid) throw new BadRequestException('Invalid reset code');

    await this.usersService.setPassword(user.id, newPassword);
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
