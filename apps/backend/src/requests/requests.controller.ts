import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get()
  findAll() {
    return this.requestsService.findAll();
  }

  @Get('mine')
  findMine(@CurrentUser('id') userId: string) {
    return this.requestsService.findMine(userId);
  }

  @Post()
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    return this.requestsService.create(body, userId);
  }

  @Patch(':id/issue')
  @Roles(UserRole.HR, UserRole.ADMIN)
  issue(@Param('id') id: string) {
    return this.requestsService.issue(id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.HR, UserRole.ADMIN)
  reject(@Param('id') id: string) {
    return this.requestsService.reject(id);
  }
}
