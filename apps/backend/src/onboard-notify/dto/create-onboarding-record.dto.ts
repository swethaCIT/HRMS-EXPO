import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnboardEmployeeType } from '../entities/onboarding-record.entity';

export class CreateOnboardingRecordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  tempName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  mobile: string;

  @ApiProperty({ description: "Candidate's personal email — the secure onboarding link is sent here" })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: OnboardEmployeeType })
  @IsEnum(OnboardEmployeeType)
  employeeType: OnboardEmployeeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedJoiningDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  designation?: string;

  @ApiPropertyOptional({ description: 'employees.id of the reporting manager' })
  @IsOptional()
  @IsUUID()
  reportingManagerId?: string;
}
