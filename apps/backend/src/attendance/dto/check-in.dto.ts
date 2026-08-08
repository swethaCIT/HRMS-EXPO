import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CheckInDto {
  @ApiPropertyOptional({ enum: ['office', 'wfh'], default: 'office' })
  @IsOptional()
  @IsIn(['office', 'wfh'])
  mode?: 'office' | 'wfh';

  /** Where the punch came from — `manual` today, `biometric`/`geofence` later. */
  @ApiPropertyOptional({ description: 'Punch source', default: 'manual' })
  @IsOptional()
  @IsString()
  source?: string;
}
