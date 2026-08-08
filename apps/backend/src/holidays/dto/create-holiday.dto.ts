import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Replaces `@Body() body: any` — see CreateAnnouncementDto for why that matters. */
export class CreateHolidayDto {
  @ApiProperty({ example: '2026-12-25' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Christmas' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ enum: ['public', 'optional', 'company'], default: 'public' })
  @IsOptional()
  @IsIn(['public', 'optional', 'company'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
