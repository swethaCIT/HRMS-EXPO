import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiForbiddenResponse } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { User } from '../users/entities/user.entity';
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

  /** The org-wide queue backs the approvals inbox — employees use `/mine`. */
  @Get()
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'All tickets (manager/HR/Admin)' })
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.ticketsService.findAll(limit ? +limit : undefined, offset ? +offset : undefined);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Tickets I raised' })
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

  /** Only the raiser may withdraw their own ticket (or a manager/HR/Admin). */
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a ticket', description: 'You can only cancel a ticket you raised.' })
  @ApiForbiddenResponse({ description: 'Not your ticket' })
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ticketsService.cancel(id, user);
  }

  /** Moving a ticket through its workflow is an agent action, not the raiser's. */
  @Patch(':id/status')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Set ticket status (manager/HR/Admin)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.ticketsService.updateStatus(id, dto.status);
  }
}
