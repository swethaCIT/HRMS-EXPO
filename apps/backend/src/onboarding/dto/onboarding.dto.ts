import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteCandidateDto {
  @ApiProperty({ description: "The candidate's personal email — the invite is sent here" })
  @IsEmail()
  personalEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

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
}

export class VerifyInviteDto {
  @ApiProperty()
  @IsEmail()
  personalEmail: string;

  @ApiProperty({ description: '6-digit one-time code from the invite email' })
  @IsString()
  @Length(6, 6)
  code: string;
}

/**
 * PUBLIC, UNAUTHENTICATED endpoint that provisions a real account and sets its
 * password — so it is the last place that should accept an unvalidated body.
 * The untyped version also allowed extra keys straight through to
 * `employeeRepo.create`, letting a candidate set fields (department,
 * designation, employeeId…) that HR is supposed to control.
 */
export class CompleteOnboardingDto {
  @ApiProperty()
  @IsEmail()
  personalEmail: string;

  @ApiProperty({ description: '6-digit one-time code from the invite email' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContactPhone?: string;
}
