import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  /** Register/refresh the signed-in user's own FCM device token — self-service, no role check needed. */
  @Patch('fcm-token')
  async updateFcmToken(
    @CurrentUser('id') userId: string,
    @Body('token') token: string,
  ) {
    await this.usersService.updateFcmToken(userId, token);
    return { success: true };
  }

  /* ── In-app notifications for the signed-in user ── */
  @Get()
  findMine(@CurrentUser('id') userId: string) {
    return this.notificationsService.findForUser(userId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService
      .unreadCount(userId)
      .then((count) => ({ count }));
  }

  @Patch('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markRead(id, userId);
  }

  /* ── Push (FCM) ── */
  @Post('send')
  send(
    @Body('token') token: string,
    @Body('title') title: string,
    @Body('body') body: string,
    @Body('data') data?: Record<string, string>,
  ) {
    return this.notificationsService.sendToDevice(token, title, body, data);
  }
}
