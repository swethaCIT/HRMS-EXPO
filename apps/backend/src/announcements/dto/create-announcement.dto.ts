import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Replaces `@Body() body: any`. Nest skips validation entirely without a DTO
 * class, so the untyped body accepted arbitrary keys — including `id`, which
 * makes TypeORM `save()` an UPDATE and lets a caller overwrite an existing
 * announcement, and `authorId`, which let them forge the author.
 */
export class CreateAnnouncementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({ enum: ['general', 'policy', 'event', 'urgent'], default: 'general' })
  @IsOptional()
  @IsIn(['general', 'policy', 'event', 'urgent'])
  category?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}
