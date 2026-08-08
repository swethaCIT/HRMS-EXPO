import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  findAll() {
    return this.holidaysService.findAll();
  }

  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  create(@Body() dto: CreateHolidayDto) {
    return this.holidaysService.create({ ...dto, date: new Date(dto.date) });
  }

  @Delete(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}
