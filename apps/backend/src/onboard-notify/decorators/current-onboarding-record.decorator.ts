import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OnboardingRecord } from '../entities/onboarding-record.entity';

/** The record OnboardingSessionGuard resolved and attached to the request. Only usable behind that guard. */
export const CurrentOnboardingRecord = createParamDecorator((_: unknown, ctx: ExecutionContext): OnboardingRecord => {
  return ctx.switchToHttp().getRequest().onboardingRecord;
});
