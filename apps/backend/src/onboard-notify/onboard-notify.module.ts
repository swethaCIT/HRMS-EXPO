import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingRecord } from './entities/onboarding-record.entity';
import { OnboardingToken } from './entities/onboarding-token.entity';
import { OnboardingFormResponse } from './entities/onboarding-form-response.entity';
import { OnboardingReview } from './entities/onboarding-review.entity';
import { OnboardingForward } from './entities/onboarding-forward.entity';
import { OnboardNotifyService } from './onboard-notify.service';
import { OnboardNotifyController } from './onboard-notify.controller';
import { OnboardNotifyPublicService } from './onboard-notify-public.service';
import { OnboardNotifyPublicController } from './onboard-notify-public.controller';
import { OnboardingTokenService } from './onboarding-token.service';
import { OnboardingTokenGuard } from './guards/onboarding-token.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnboardingRecord, OnboardingToken, OnboardingFormResponse, OnboardingReview, OnboardingForward]),
    NotificationsModule,
    StorageModule,
    UsersModule,
    EmployeesModule,
  ],
  controllers: [OnboardNotifyController, OnboardNotifyPublicController],
  providers: [OnboardNotifyService, OnboardNotifyPublicService, OnboardingTokenService, OnboardingTokenGuard],
})
export class OnboardNotifyModule {}
