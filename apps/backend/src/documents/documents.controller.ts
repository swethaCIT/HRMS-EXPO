import { Controller, Get, Post, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.documentsService.findByEmployee(employeeId);
  }

  @Post()
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    return this.documentsService.create({ ...body, uploadedById: userId });
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: any,
    @Body('employeeId') employeeId: string,
    @Body('category') category: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.upload(file, employeeId, category, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
