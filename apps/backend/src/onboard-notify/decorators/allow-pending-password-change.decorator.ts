import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE = 'allowPendingPasswordChange';

/** Lets a handler run even while OnboardingRecord.mustChangePassword is true — only the change-password endpoint itself should carry this. */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE, true);
