import { IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Section payloads are loosely-typed objects (like Request.detail elsewhere
 * in this codebase) rather than exhaustively-validated DTOs — the fields
 * within each section are UI-defined and HR only ever sees/forwards a
 * whitelisted subset (see onboarding-field-catalog.ts), so over-validating
 * their shape here wouldn't add real protection.
 */
export class PublicSubmitFormDto {
  @ApiProperty()
  @IsObject()
  personalDetails: Record<string, any>;

  @ApiProperty()
  @IsObject()
  contactInfo: Record<string, any>;

  @ApiProperty()
  @IsObject()
  emergencyContact: Record<string, any>;

  @ApiProperty()
  @IsObject()
  education: Record<string, any>;

  @ApiProperty()
  @IsObject()
  bankDetails: Record<string, any>;

  @ApiPropertyOptional({ description: 'Experienced-hire only; omitted/ignored for freshers.' })
  @IsOptional()
  @IsObject()
  employmentHistory?: Record<string, any>;
}
