import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnboardReviewDecision } from '../entities/onboarding-review.entity';

export class ReviewDecisionDto {
  @ApiProperty({ enum: OnboardReviewDecision })
  @IsEnum(OnboardReviewDecision)
  decision: OnboardReviewDecision;

  // Not @IsOptional — required exactly when decision is CHANGES_REQUESTED
  // (see @ValidateIf), skipped entirely otherwise.
  @ApiPropertyOptional({ description: 'Required when requesting changes — tells the candidate what to fix.' })
  @ValidateIf((o) => o.decision === OnboardReviewDecision.CHANGES_REQUESTED)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comments?: string;
}
