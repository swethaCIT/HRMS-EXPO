import { ArrayNotEmpty, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnboardReviewDecision } from '../entities/onboarding-review.entity';

export class CorrectionSectionDto {
  @ApiProperty({ description: 'A section key, e.g. "employmentHistory" — see GET /onboard-notify/:id for the valid keys for that employee type.' })
  @IsString()
  @IsNotEmpty()
  section: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class ReviewDecisionDto {
  @ApiProperty({ enum: OnboardReviewDecision })
  @IsEnum(OnboardReviewDecision)
  decision: OnboardReviewDecision;

  // Not @IsOptional — required exactly when decision is CHANGES_REQUESTED
  // (see @ValidateIf), skipped entirely otherwise. Overall remark shown to
  // the candidate alongside any per-section reasons below.
  @ApiPropertyOptional({ description: 'Required when requesting changes — an overall note to the candidate.' })
  @ValidateIf((o) => o.decision === OnboardReviewDecision.CHANGES_REQUESTED)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comments?: string;

  @ApiPropertyOptional({
    type: [CorrectionSectionDto],
    description: 'Which section(s) need fixing, and why. Omit to leave every section editable (backward-compatible default).',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CorrectionSectionDto)
  correctionSections?: CorrectionSectionDto[];
}
