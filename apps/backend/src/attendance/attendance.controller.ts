import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiForbiddenResponse } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from '../common/access/access-control.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CheckInDto } from './dto/check-in.dto';

/**
 * Punching is self-service. Only HR/Admin may punch on someone else's behalf
 * (a genuine correction); without that restriction any employee could mark an
 * absent colleague present simply by putting their id in the URL.
 */
@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly access: AccessControlService,
  ) {}

  @Post(':employeeId/check-in')
  @ApiOperation({ summary: 'Punch in', description: 'You may punch in only for yourself; HR/Admin may record on behalf of someone else.' })
  @ApiParam({ name: 'employeeId' })
  @ApiForbiddenResponse({ description: 'You cannot punch in for another employee' })
  async checkIn(@Param('employeeId') employeeId: string, @Body() dto: CheckInDto, @CurrentUser() user: User) {
    await this.access.assertSelfOr(user, employeeId, AccessControlService.ORG_WIDE, 'attendance');
    return this.attendanceService.checkIn(employeeId, { mode: dto.mode, source: dto.source });
  }

  @Post(':employeeId/check-out')
  @ApiOperation({ summary: 'Punch out' })
  @ApiParam({ name: 'employeeId' })
  @ApiForbiddenResponse({ description: 'You cannot punch out for another employee' })
  async checkOut(@Param('employeeId') employeeId: string, @CurrentUser() user: User) {
    await this.access.assertSelfOr(user, employeeId, AccessControlService.ORG_WIDE, 'attendance');
    return this.attendanceService.checkOut(employeeId);
  }

  @Get('today/:employeeId')
  @ApiOperation({ summary: "Today's record" })
  @ApiParam({ name: 'employeeId' })
  async today(@Param('employeeId') employeeId: string, @CurrentUser() user: User) {
    await this.access.assertSelfOr(user, employeeId, AccessControlService.ORG_WIDE_WITH_MANAGERS, 'attendance');
    return this.attendanceService.getToday(employeeId);
  }

  @Get()
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'All attendance (manager/HR/Admin)', description: 'Paged — newest first. Default 50, max 200 per request.' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.attendanceService.findAll(limit ? +limit : undefined, offset ? +offset : undefined);
  }

  @Get(':employeeId')
  @ApiOperation({ summary: 'Attendance history for one employee', description: 'Your own, or anyone’s if you are a manager/HR/Admin. Paged.' })
  @ApiParam({ name: 'employeeId' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async findByEmployee(
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    await this.access.assertSelfOr(user, employeeId, AccessControlService.ORG_WIDE_WITH_MANAGERS, 'attendance');
    return this.attendanceService.findByEmployee(employeeId, limit ? +limit : undefined, offset ? +offset : undefined);
  }
}
