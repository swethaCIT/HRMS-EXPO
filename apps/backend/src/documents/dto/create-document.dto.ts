import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Replaces `@Body() body: any`. Besides skipping all validation, the untyped
 * body let a caller pass `id`, which makes TypeORM `save()` perform an UPDATE —
 * silently overwriting an existing HR document.
 */
export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: ['id', 'contract', 'payslip', 'certificate', 'other'], default: 'other' })
  @IsOptional()
  @IsIn(['id', 'contract', 'payslip', 'certificate', 'other'])
  category?: string;

  @ApiProperty({ description: 'Storage URL' })
  @IsUrl({ require_tld: false })
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  size?: number;
}
