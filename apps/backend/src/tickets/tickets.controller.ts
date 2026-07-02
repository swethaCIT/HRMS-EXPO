import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser('id') userId: string) {
    return this.ticketsService.create(dto, userId);
  }

  @Get()
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.ticketsService.findAll(limit ? +limit : undefined, offset ? +offset : undefined);
  }

  @Get('mine')
  findMine(@CurrentUser('id') userId: string) {
    return this.ticketsService.findMine(userId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  approve(@Param('id') id: string) {
    return this.ticketsService.approve(id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  reject(@Param('id') id: string) {
    return this.ticketsService.reject(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ticketsService.updateStatus(id, status);
  }
}
