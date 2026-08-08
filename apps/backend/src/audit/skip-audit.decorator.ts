import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT = 'skipAudit';

/**
 * Suppresses the generic interceptor entry for a handler.
 *
 * Use it where the service already records the event with real detail — a
 * human summary, the subject, and field-level before/after. Without this the
 * feed shows both, e.g. "admin updated user" immediately above "admin changed
 * rahul@… from employee to manager", which buries the useful line in noise.
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT, true);
