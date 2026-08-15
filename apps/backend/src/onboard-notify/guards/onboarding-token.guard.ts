import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnboardingTokenService } from '../onboarding-token.service';
import { OnboardingRecord } from '../entities/onboarding-record.entity';

/**
 * Public-endpoint guard: resolves the `:token` route param to exactly one
 * OnboardingRecord and attaches it to the request. This is the only access
 * check these endpoints have (no JwtAuthGuard) — it must never leak whether
 * a token is malformed vs. expired vs. simply unknown, and it must never
 * expose any HRMS data beyond the single record the token maps to.
 */
@Injectable()
export class OnboardingTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: OnboardingTokenService,
    @InjectRepository(OnboardingRecord)
    private readonly recordRepo: Repository<OnboardingRecord>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const raw = req.params?.token;
    const onboardingId = await this.tokens.resolve(raw);
    if (!onboardingId) throw new NotFoundException('This onboarding link is invalid or has expired.');

    const record = await this.recordRepo.findOne({ where: { id: onboardingId } });
    if (!record) throw new NotFoundException('This onboarding link is invalid or has expired.');

    req.onboardingRecord = record;
    return true;
  }
}
