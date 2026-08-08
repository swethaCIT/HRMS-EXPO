import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiForbiddenResponse } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from '../common/access/access-control.service';
import { User, UserRole } from '../users/entities/user.entity';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';

/**
 * Salary is the most sensitive record here: org-wide reads and every write are
 * HR/Admin only, and an employee may read only their own payslips. Managers are
 * deliberately excluded — running a team does not imply seeing pay.
 */
@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly access: AccessControlService,
  ) {}

  @Post('generate')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate a payslip (HR/Admin only)' })
  @ApiForbiddenResponse({ description: 'Only HR and Admin may generate payroll' })
  generate(@Body() dto: GeneratePayrollDto) {
    return this.payrollService.generate(dto.employeeId, dto.month, dto.year, dto.basicSalary);
  }

  @Get()
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'All payslips (HR/Admin only)', description: 'Paged — newest first. Default 50, max 200.' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.payrollService.findAll(limit ? +limit : undefined, offset ? +offset : undefined);
  }

  @Get('employee/:employeeId')
  @ApiOperation({
    summary: 'Payslips for one employee',
    description: 'Employees may read only their own; HR/Admin may read anyone’s.',
  })
  @ApiParam({ name: 'employeeId' })
  @ApiForbiddenResponse({ description: 'Not your payslip' })
  async findByEmployee(@Param('employeeId') employeeId: string, @CurrentUser() user: User) {
    await this.access.assertSelfOr(user, employeeId, AccessControlService.ORG_WIDE, 'payslips');
    return this.payrollService.findByEmployee(employeeId);
  }

  @Patch(':id/pay')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark a payslip paid (HR/Admin only)' })
  @ApiParam({ name: 'id' })
  markAsPaid(@Param('id') id: string) {
    return this.payrollService.markAsPaid(id);
  }
}
