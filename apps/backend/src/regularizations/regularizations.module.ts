import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Regularization } from './entities/regularization.entity';
import { RegularizationsService } from './regularizations.service';
import { RegularizationsController } from './regularizations.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Regularization]), NotificationsModule, UsersModule],
  controllers: [RegularizationsController],
  providers: [RegularizationsService],
  exports: [RegularizationsService],
})
export class RegularizationsModule {}
