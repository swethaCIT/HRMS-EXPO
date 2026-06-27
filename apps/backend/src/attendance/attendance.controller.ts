import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post(':employeeId/check-in')
  checkIn(@Param('employeeId') employeeId: string) {
    return this.attendanceService.checkIn(employeeId);
  }

  @Post(':employeeId/check-out')
  checkOut(@Param('employeeId') employeeId: string) {
    return this.attendanceService.checkOut(employeeId);
  }

  @Get()
  findAll() {
    return this.attendanceService.findAll();
  }

  @Get(':employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.attendanceService.findByEmployee(employeeId);
  }
}
