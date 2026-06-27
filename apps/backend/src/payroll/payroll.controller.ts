import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('generate')
  generate(
    @Body('employeeId') employeeId: string,
    @Body('month') month: number,
    @Body('year') year: number,
    @Body('basicSalary') basicSalary: number,
  ) {
    return this.payrollService.generate(employeeId, month, year, basicSalary);
  }

  @Get()
  findAll() {
    return this.payrollService.findAll();
  }

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.payrollService.findByEmployee(employeeId);
  }

  @Patch(':id/pay')
  markAsPaid(@Param('id') id: string) {
    return this.payrollService.markAsPaid(id);
  }
}
