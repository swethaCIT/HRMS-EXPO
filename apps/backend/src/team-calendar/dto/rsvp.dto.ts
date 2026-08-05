import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

// Deliberately excludes "Pending" — that's only the initial default, never a value a participant sets.
export enum RsvpStatus {
  ACCEPTED = 'Accepted',
  DECLINED = 'Declined',
  TENTATIVE = 'Tentative',
}

export class RsvpDto {
  @ApiProperty({ enum: RsvpStatus })
  @IsEnum(RsvpStatus)
  status: RsvpStatus;
}
