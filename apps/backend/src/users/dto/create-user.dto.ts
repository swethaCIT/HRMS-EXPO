import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  /**
   * NO field initializer here, deliberately.
   *
   * `UpdateUserDto extends PartialType(CreateUserDto)`, and a default value on
   * the class survives that — so every instantiated update DTO carried
   * `role: 'employee'` even when the caller never sent it. Deactivating a
   * manager therefore silently demoted them to employee, invisibly, on an
   * endpoint that looked like it only touched `isActive`. The service applies
   * the default instead, where it only affects creation.
   */
  @ApiPropertyOptional({ enum: UserRole, default: UserRole.EMPLOYEE })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
