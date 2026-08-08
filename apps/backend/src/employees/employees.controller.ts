import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiForbiddenResponse } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

/**
 * The people directory. Reading it is open to every signed-in user (the app's
 * pickers and team screens need it), but creating, editing and removing an
 * employee record is HR/Admin only — previously any employee could rewrite a
 * colleague's reporting line or hard-delete their record outright.
 */
@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an employee record (HR/Admin)' })
  @ApiForbiddenResponse({ description: 'Only HR and Admin may create employee records' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.employeesService.findAll(
      limit ? +limit : undefined,
      offset ? +offset : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an employee record (HR/Admin)' })
  @ApiForbiddenResponse({ description: 'Only HR and Admin may edit employee records' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an employee record (Admin only)', description: 'This is a hard delete and cannot be undone.' })
  @ApiForbiddenResponse({ description: 'Only Admin may delete employee records' })
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
