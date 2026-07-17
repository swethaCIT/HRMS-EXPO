import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmployeesModule } from './employees/employees.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeavesModule } from './leaves/leaves.module';
import { PayrollModule } from './payroll/payroll.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { TicketsModule } from './tickets/tickets.module';
import { AssetsModule } from './assets/assets.module';
import { RequestsModule } from './requests/requests.module';
import { MailModule } from './mail/mail.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HolidaysModule } from './holidays/holidays.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { DocumentsModule } from './documents/documents.module';
import { RegularizationsModule } from './regularizations/regularizations.module';
import { HealthController } from './health/health.controller';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { getDatabaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting per client IP (see `trust proxy` in main.ts): 300 req / 60s
    // — ~5 req/s sustained, generous for a mobile client while still shedding
    // abusive/runaway traffic with 429 instead of letting it overwhelm the DB.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    // In-memory cache (fast, zero external deps). Redis was causing connection
    // retry storms + slow/flaky startup when it wasn't running.
    CacheModule.register({ isGlobal: true, ttl: 300_000 }),
    AuthModule,
    UsersModule,
    EmployeesModule,
    AttendanceModule,
    LeavesModule,
    PayrollModule,
    NotificationsModule,
    StorageModule,
    TicketsModule,
    AssetsModule,
    RequestsModule,
    MailModule,
    OnboardingModule,
    AnalyticsModule,
    HolidaysModule,
    AnnouncementsModule,
    DocumentsModule,
    RegularizationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
  ],
})
export class AppModule {}
