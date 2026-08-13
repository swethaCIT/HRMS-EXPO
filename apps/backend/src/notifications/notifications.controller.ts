import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiForbiddenResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  /** Register/refresh the signed-in user's own Expo push token — self-service, no role check needed. */
  @Patch('push-token')
  async updateExpoPushToken(
    @CurrentUser('id') userId: string,
    @Body('token') token: string,
  ) {
    await this.usersService.updateExpoPushToken(userId, token);
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

  /* ── Push (Expo) ── */
  /**
   * Admin-only. This forwards a caller-supplied device token and message
   * straight to the Expo push service: left open, any employee could push a convincing spoofed
   * alert ("Payroll action required") that renders with the company's own app
   * identity to any device token they could harvest.
   */
  @Post('send')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Send a raw push notification (Admin only)' })
  @ApiForbiddenResponse({ description: 'Only Admin may send raw push notifications' })
  send(
    @Body('token') token: string,
    @Body('title') title: string,
    @Body('body') body: string,
    @Body('data') data?: Record<string, string>,
  ) {
    return this.notificationsService.sendToDevice(token, title, body, data);
  }
}
