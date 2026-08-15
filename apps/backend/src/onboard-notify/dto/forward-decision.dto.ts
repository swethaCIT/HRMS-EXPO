import { ArrayNotEmpty, IsArray, IsEnum, IsIn, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OnboardDepartment } from '../entities/onboarding-forward.entity';
import { ONBOARD_FIELD_CATALOG } from '../onboarding-field-catalog';

const KNOWN_FIELD_KEYS = Object.keys(ONBOARD_FIELD_CATALOG);

export class ForwardEntryDto {
  @ApiProperty({ enum: OnboardDepartment })
  @IsEnum(OnboardDepartment)
  department: OnboardDepartment;

  @ApiProperty({ description: 'users.id of the recipient in that department' })
  @IsUUID()
  recipientUserId: string;

  @ApiProperty({
    type: [String],
    description: 'Field keys HR approved for this recipient — see GET /onboard-notify/field-catalog',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(KNOWN_FIELD_KEYS, { each: true })
  fieldsShared: string[];
}

export class ForwardDecisionDto {
  @ApiProperty({ type: [ForwardEntryDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ForwardEntryDto)
  forwards: ForwardEntryDto[];
}
