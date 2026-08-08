import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiForbiddenResponse } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from '../common/access/access-control.service';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leaves')
export class LeavesController {
  constructor(
    private readonly leavesService: LeavesService,
    private readonly access: AccessControlService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Apply for leave', description: 'You may only file leave in your own name — HR/Admin may file on behalf of someone else.' })
  @ApiForbiddenResponse({ description: 'You cannot file leave for another employee' })
  async create(@Body() dto: CreateLeaveDto, @CurrentUser() user: User) {
    await this.access.assertSelfOr(user, dto.employeeId, AccessControlService.ORG_WIDE, 'leave');
    return this.leavesService.create(dto);
  }

  @Get()
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'All leave requests (manager/HR/Admin)', description: 'Backs the approvals inbox. Paged — default 50, max 200.' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.leavesService.findAll(limit ? +limit : undefined, offset ? +offset : undefined);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Leave history for one employee', description: 'Your own, or anyone’s if you approve leave.' })
  @ApiParam({ name: 'employeeId' })
  async findByEmployee(@Param('employeeId') employeeId: string, @CurrentUser() user: User) {
    await this.access.assertSelfOr(user, employeeId, AccessControlService.ORG_WIDE_WITH_MANAGERS, 'leave');
    return this.leavesService.findByEmployee(employeeId);
  }

  @Get('balance/:employeeId')
  @ApiOperation({ summary: 'Leave balance for one employee' })
  @ApiParam({ name: 'employeeId' })
  async getBalance(@Param('employeeId') employeeId: string, @CurrentUser() user: User) {
    await this.access.assertSelfOr(user, employeeId, AccessControlService.ORG_WIDE_WITH_MANAGERS, 'leave balance');
    return this.leavesService.getBalance(employeeId);
  }

  /**
   * The approver is the authenticated caller — never a body field. Taking it
   * from the request let anyone attribute their decision to another user,
   * destroying the audit trail; it was also always undefined in practice,
   * since the app sends no body here.
   */
  @Patch(':id/approve')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  approve(@Param('id') id: string, @CurrentUser('id') approverId: string) {
    return this.leavesService.approve(id, approverId);
  }

  @Patch(':id/reject')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  reject(@Param('id') id: string, @Body('reason') reason: string) {
    return this.leavesService.reject(id, reason);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Withdraw a pending leave request', description: 'Only the applicant (or HR/Admin) may cancel it.' })
  @ApiParam({ name: 'id' })
  @ApiForbiddenResponse({ description: 'You can only cancel your own leave request' })
  async cancel(@Param('id') id: string, @CurrentUser() user: User) {
    const privileged = this.access.has(user, AccessControlService.ORG_WIDE);
    const actorEmployeeId = privileged ? undefined : await this.access.employeeIdOf(user);
    return this.leavesService.cancel(id, { privileged, actorEmployeeId: actorEmployeeId ?? undefined });
  }
}
