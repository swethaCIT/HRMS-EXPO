import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TeamCalendarService } from './team-calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class TeamCalendarController {
  constructor(private readonly calendar: TeamCalendarService) {}

  @Post('events')
  create(@Body() dto: CreateEventDto, @CurrentUser('id') userId: string) {
    return this.calendar.create(dto, userId);
  }

  @Get('events')
  findRange(@Query('start') start?: string, @Query('end') end?: string) {
    return this.calendar.findRange(start, end);
  }

  @Get('upcoming')
  upcoming(@CurrentUser('id') userId: string) {
    return this.calendar.upcoming(userId);
  }

  @Get('employees/search')
  searchEmployees(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('excludeEventId') excludeEventId?: string,
  ) {
    return this.calendar.searchEmployees(
      q,
      page ? +page : undefined,
      limit ? +limit : undefined,
      start,
      end,
      excludeEventId,
    );
  }

  @Get('events/:id')
  findOne(@Param('id') id: string) {
    return this.calendar.findOne(id);
  }

  @Put('events/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.calendar.update(id, dto, userId);
  }

  @Delete('events/:id')
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.calendar.cancel(id, userId);
  }

  @Put('events/:id/rsvp')
  rsvp(
    @Param('id') id: string,
    @Body() dto: RsvpDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.calendar.rsvp(id, dto, userId);
  }
}
