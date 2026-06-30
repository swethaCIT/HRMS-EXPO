import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser('id') userId: string) {
    return this.ticketsService.create(dto, userId);
  }

  @Get()
  findAll() {
    return this.ticketsService.findAll();
  }

  @Get('mine')
  findMine(@CurrentUser('id') userId: string) {
    return this.ticketsService.findMine(userId);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.ticketsService.approve(id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.ticketsService.reject(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ticketsService.updateStatus(id, status);
  }
}
