import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Replaces a raw `@Body('status') status: string` written straight to the column. */
export class UpdateTicketStatusDto {
  @ApiProperty({ enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'Cancelled'] })
  @IsIn(['Open', 'In Progress', 'Resolved', 'Closed', 'Cancelled'])
  status: string;
}
