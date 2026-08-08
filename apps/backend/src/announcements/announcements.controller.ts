import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  findAll() {
    return this.announcementsService.findAll();
  }

  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser('id') userId: string) {
    // authorId comes from the token, never the body.
    return this.announcementsService.create({ ...dto, authorId: userId });
  }

  @Delete(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.announcementsService.remove(id);
  }
}
