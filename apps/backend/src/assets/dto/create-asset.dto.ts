import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Replaces `@Body() body: any`. Nest's ValidationPipe skips validation entirely
 * when there is no DTO class, so the previous signature accepted arbitrary keys
 * — including `id`, which turned TypeORM's `save()` into an UPDATE and let a
 * caller overwrite an existing asset row.
 */
export class CreateAssetDto {
  @ApiProperty({ example: 'LAP-2041' })
  @IsString()
  @IsNotEmpty()
  assetTag: string;

  @ApiProperty({ example: 'MacBook Pro 14"' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ['Laptop', 'Monitor', 'Phone', 'Accessory', 'Other'] })
  @IsIn(['Laptop', 'Monitor', 'Phone', 'Accessory', 'Other'])
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ enum: ['Good', 'Fair', 'Damaged'], default: 'Good' })
  @IsOptional()
  @IsIn(['Good', 'Fair', 'Damaged'])
  condition?: string;

  @ApiPropertyOptional({ enum: ['assigned', 'returned'], default: 'assigned' })
  @IsOptional()
  @IsIn(['assigned', 'returned'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  assignedDate?: string;

  @ApiProperty({ description: 'Employee the asset is issued to' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;
}
