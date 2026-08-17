import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The section key itself comes from the route param (`PUT .../sections/:key`)
 * and is validated against `isValidSectionKey()` in the service — it varies
 * per employee type, so it can't be a fixed enum here. The payload shape is
 * intentionally loose, same rationale as the old bulk-submit DTO it replaces:
 * see onboarding-field-catalog.ts / the Request.detail jsonb precedent.
 */
export class SaveSectionDto {
  @ApiProperty()
  @IsObject()
  data: Record<string, any>;
}
