import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post()
  create(@Body() dto: CreateLeaveDto) {
    return this.leavesService.create(dto);
  }

  @Get()
  findAll() {
    return this.leavesService.findAll();
  }

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.leavesService.findByEmployee(employeeId);
  }

  @Get('balance/:employeeId')
  getBalance(@Param('employeeId') employeeId: string) {
    return this.leavesService.getBalance(employeeId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  approve(@Param('id') id: string, @Body('approverId') approverId: string) {
    return this.leavesService.approve(id, approverId);
  }

  @Patch(':id/reject')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  reject(@Param('id') id: string, @Body('reason') reason: string) {
    return this.leavesService.reject(id, reason);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.leavesService.cancel(id);
  }
}
