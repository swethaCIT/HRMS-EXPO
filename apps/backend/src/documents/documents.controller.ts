import { Controller, Get, Post, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiForbiddenResponse } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from '../common/access/access-control.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateDocumentDto } from './dto/create-document.dto';

/**
 * The employee document centre — contracts, ID proofs, payslips, certificates.
 * Reads are scoped to the owner (or HR/Admin); creating and deleting are HR/Admin
 * only, so an employee cannot plant or destroy an HR record.
 */
@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly access: AccessControlService,
  ) {}

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Documents for one employee', description: 'Your own, or anyone’s if you are HR/Admin.' })
  @ApiParam({ name: 'employeeId' })
  @ApiForbiddenResponse({ description: 'Not your documents' })
  async findByEmployee(@Param('employeeId') employeeId: string, @CurrentUser() user: User) {
    await this.access.assertSelfOr(user, employeeId, AccessControlService.ORG_WIDE, 'documents');
    return this.documentsService.findByEmployee(employeeId);
  }

  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Register a document (HR/Admin)' })
  create(@Body() dto: CreateDocumentDto, @CurrentUser('id') userId: string) {
    return this.documentsService.create({ ...dto, uploadedById: userId });
  }

  @Post('upload')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a document file (HR/Admin)' })
  upload(
    @UploadedFile() file: any,
    @Body('employeeId') employeeId: string,
    @Body('category') category: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.upload(file, employeeId, category, userId);
  }

  @Delete(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a document (HR/Admin)' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
