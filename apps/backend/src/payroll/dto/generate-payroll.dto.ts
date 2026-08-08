import { IsInt, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Replaces the previous raw `@Body('field')` primitives. Without a DTO class the
 * global ValidationPipe has no schema to enforce, so a non-numeric salary
 * reached Postgres as NaN and 500'd on `invalid input syntax for type numeric`.
 */
export class GeneratePayrollDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ description: 'Monthly basic salary' })
  @IsNumber()
  @Min(0)
  basicSalary: number;
}
