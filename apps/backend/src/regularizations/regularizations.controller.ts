import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RegularizationsService } from './regularizations.service';
import { CreateRegularizationDto } from './dto/create-regularization.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('regularizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('regularizations')
export class RegularizationsController {
  constructor(private readonly regularizationsService: RegularizationsService) {}

  @Post()
  create(@Body() dto: CreateRegularizationDto) {
    return this.regularizationsService.create(dto);
  }

  @Get()
  findAll() {
    return this.regularizationsService.findAll();
  }

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
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
