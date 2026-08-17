import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnboardingAuthService } from '../onboarding-auth.service';
import { OnboardingRecord } from '../entities/onboarding-record.entity';
import { ALLOW_PENDING_PASSWORD_CHANGE } from '../decorators/allow-pending-password-change.decorator';

/**
 * Public-facing portal guard: verifies the bearer session JWT, re-checks
 * `mustChangePassword` against the live row (not the JWT claim, which would
 * otherwise still say `true` for the rest of a token's lifetime even after
 * the candidate just changed it), and scopes the request to exactly one
 * OnboardingRecord. No JwtAuthGuard involvement — this is a completely
 * separate identity from any HRMS `User`.
 */
@Injectable()
export class OnboardingSessionGuard implements CanActivate {
  constructor(
    private readonly auth: OnboardingAuthService,
    @InjectRepository(OnboardingRecord)
    private readonly recordRepo: Repository<OnboardingRecord>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Not signed in.');

    const payload = this.auth.verifySession(token);
    const record = await this.recordRepo.findOne({ where: { id: payload.sub } });
    if (!record) throw new UnauthorizedException('Your session has expired — please log in again.');

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (record.mustChangePassword && !allowPending) {
      throw new ForbiddenException('You must change your temporary password before continuing.');
    }

    req.onboardingRecord = record;
    return true;
  }
}
