import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ProjectsModule } from './projects/projects.module';
import { TeamCalendarModule } from './team-calendar/team-calendar.module';
import { OnboardNotifyModule } from './onboard-notify/onboard-notify.module';
import { AccessControlModule } from './common/access/access-control.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { HealthController } from './health/health.controller';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { getDatabaseConfig } from './config/database.config';
import { buildCacheOptions } from './config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting per client IP (see `trust proxy` in main.ts): 300 req / 60s
    // — ~5 req/s sustained, generous for a mobile client while still shedding
    // abusive/runaway traffic with 429 instead of letting it overwhelm the DB.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    // Powers @Cron methods (calendar reminders, notification retry).
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    // Redis when configured (REDIS_URL / CACHE_DRIVER=redis), in-memory
    // otherwise. Shared cache matters once there is more than one replica —
    // see buildCacheOptions. Never blocks startup if Redis is unreachable.
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildCacheOptions,
    }),
    AccessControlModule,
    AuditModule,
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
    ProjectsModule,
    TeamCalendarModule,
    OnboardNotifyModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    // Safety net: records every mutating request, including refused ones.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
