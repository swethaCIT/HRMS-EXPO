import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OnboardingRecord } from './entities/onboarding-record.entity';
import { OnboardingFormResponse } from './entities/onboarding-form-response.entity';
import { OnboardingReview } from './entities/onboarding-review.entity';
import { OnboardingForward } from './entities/onboarding-forward.entity';
import { OnboardNotifyService } from './onboard-notify.service';
import { OnboardNotifyController } from './onboard-notify.controller';
import { OnboardNotifyPortalService } from './onboard-notify-portal.service';
import { OnboardNotifyPortalController } from './onboard-notify-portal.controller';
import { OnboardingAuthService } from './onboarding-auth.service';
import { OnboardingSessionGuard } from './guards/onboarding-session.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnboardingRecord, OnboardingFormResponse, OnboardingReview, OnboardingForward]),
    NotificationsModule,
    StorageModule,
    UsersModule,
    EmployeesModule,
    // A dedicated JwtModule instance, separate from AuthModule's — onboarding
    // portal sessions are a different identity from a real HRMS `User` and
    // must never be interchangeable with a normal bearer token. Mirrors how
    // onboarding.module.ts registers its own local JwtModule for the same reason.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('ONBOARDING_TOKEN_SECRET') || config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  // Order matters: Nest/Express matches routes in registration order, and
  // OnboardNotifyController has a guarded `GET :id`. If it were registered
  // first, a request for the portal's own `GET /onboard-notify/portal` would
  // be swallowed by `:id = "portal"` and hit JwtAuthGuard (401) before ever
  // reaching the public portal page. The portal controller must come first.
  controllers: [OnboardNotifyPortalController, OnboardNotifyController],
  providers: [OnboardNotifyService, OnboardNotifyPortalService, OnboardingAuthService, OnboardingSessionGuard],
})
export class OnboardNotifyModule {}
