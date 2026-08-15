import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationTemplatesService } from './notification-templates.service';
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, NotificationTemplate]), UsersModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationTemplatesService],
  exports: [NotificationsService, NotificationTemplatesService],
})
export class NotificationsModule {}
