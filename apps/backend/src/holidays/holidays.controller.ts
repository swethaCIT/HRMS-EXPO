import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HolidaysService } from './holidays.service';
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
  create(@Body() body: any) {
    return this.holidaysService.create(body);
  }

  @Delete(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}
