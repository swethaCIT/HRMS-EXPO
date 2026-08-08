import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiForbiddenResponse } from '@nestjs/swagger';
import { RegularizationsService } from './regularizations.service';
import { CreateRegularizationDto } from './dto/create-regularization.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from '../common/access/access-control.service';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('regularizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('regularizations')
export class RegularizationsController {
  constructor(
    private readonly regularizationsService: RegularizationsService,
    private readonly access: AccessControlService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Request an attendance correction', description: 'You may only file one in your own name.' })
  @ApiForbiddenResponse({ description: 'You cannot file a correction for another employee' })
  async create(@Body() dto: CreateRegularizationDto, @CurrentUser() user: User) {
    await this.access.assertSelfOr(user, dto.employeeId, AccessControlService.ORG_WIDE, 'attendance corrections');
    return this.regularizationsService.create(dto);
  }

  @Get()
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'All correction requests (manager/HR/Admin)', description: 'Backs the approvals inbox.' })
  findAll() {
    return this.regularizationsService.findAll();
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Corrections for one employee', description: 'Your own, or anyone’s if you approve them.' })
  async findByEmployee(@Param('employeeId') employeeId: string, @CurrentUser() user: User) {
    await this.access.assertSelfOr(
      user, employeeId, AccessControlService.ORG_WIDE_WITH_MANAGERS, 'attendance corrections',
    );
    return this.regularizationsService.findByEmployee(employeeId);
  }

  /** Approver identity comes from the token, not the body — see LeavesController. */
  @Patch(':id/approve')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  approve(@Param('id') id: string, @CurrentUser('id') approverId: string) {
    return this.regularizationsService.approve(id, approverId);
  }

  @Patch(':id/reject')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  reject(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.regularizationsService.reject(id, reason);
  }
}
