import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DetailRowDto {
  @ApiProperty()
  @IsString()
  @MaxLength(60)
  k: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  v: string;
}

/**
 * Replaces `@Body() body: any`. Note `status` is deliberately absent: it is set
 * by the service, not the caller — the untyped body let an employee submit a
 * request already marked `issued`.
 */
export class CreateRequestDto {
  @ApiProperty({ enum: ['document', 'profile', 'onboarding', 'leave'] })
  @IsIn(['document', 'profile', 'onboarding', 'leave'])
  kind: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @ApiPropertyOptional({ description: 'Short tag shown on the card, e.g. EXP' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  meta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @ApiPropertyOptional({ type: [DetailRowDto], description: 'Key/value rows shown on the expanded card' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetailRowDto)
  detail?: DetailRowDto[];
}
