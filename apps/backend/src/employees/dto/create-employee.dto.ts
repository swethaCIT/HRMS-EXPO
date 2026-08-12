import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentStatus, EmploymentType } from '../entities/employee.entity';

export class CreateEmployeeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;

  /* ────────────────────────────────────────────────────────────────────────
     Enterprise HR fields.

     These exist on the entity and are displayed on the Profile screen, but
     were MISSING here — and `UpdateEmployeeDto extends PartialType(this)`.
     With the global ValidationPipe running `forbidNonWhitelisted: true`, every
     PATCH carrying one of them was rejected with 400, so HR could not edit an
     employee's work mode, address, emergency contact, PAN, UAN or bank details
     through the API at all. The whole section was read-only by accident.
     ──────────────────────────────────────────────────────────────────────── */

  @ApiPropertyOptional({ description: 'Band / level, e.g. "L3 · Senior"' })
  @IsOptional() @IsString() @MaxLength(60)
  grade?: string;

  @ApiPropertyOptional({ example: 'Bengaluru, IN' })
  @IsOptional() @IsString() @MaxLength(120)
  workLocation?: string;

  @ApiPropertyOptional({ enum: ['Office', 'Hybrid', 'Remote'] })
  @IsOptional() @IsIn(['Office', 'Hybrid', 'Remote'])
  workMode?: string;

  @ApiPropertyOptional({ description: "Reporting manager's display name" })
  @IsOptional() @IsString() @MaxLength(120)
  reportingManager?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(40)
  gender?: string;

  @ApiPropertyOptional({ example: 'O+' })
  @IsOptional() @IsString() @MaxLength(8)
  bloodGroup?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(40)
  maritalStatus?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(60)
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsEmail()
  personalEmail?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(120)
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(20)
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ description: 'PAN. Stored as-is; treat as sensitive.' })
  @IsOptional() @IsString() @MaxLength(20)
  pan?: string;

  @ApiPropertyOptional({ description: 'PF universal account number' })
  @IsOptional() @IsString() @MaxLength(24)
  uan?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(120)
  bankName?: string;

  @ApiPropertyOptional({ description: 'Last 4 digits only — never store a full account number' })
  @IsOptional() @IsString() @MaxLength(4)
  bankLast4?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  avatarUrl?: string;
}
