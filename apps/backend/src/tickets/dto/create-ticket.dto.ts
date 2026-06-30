import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty() @IsString() @IsNotEmpty() subject: string;
  @ApiProperty() @IsString() @IsNotEmpty() dept: string;
  @ApiProperty() @IsString() @IsNotEmpty() category: string;
  @ApiProperty() @IsString() @IsNotEmpty() subCategory: string;
  @ApiPropertyOptional() @IsOptional() @IsString() priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}
