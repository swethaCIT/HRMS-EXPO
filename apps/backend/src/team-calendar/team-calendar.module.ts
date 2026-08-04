import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamCalendarService } from './team-calendar.service';
import { TeamCalendarController } from './team-calendar.controller';
import { CalendarReminderService } from './calendar-reminder.service';
import { CalendarEvent } from './entities/calendar-event.entity';
import { EventParticipant } from './entities/event-participant.entity';
import { EmployeesModule } from '../employees/employees.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HolidaysModule } from '../holidays/holidays.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarEvent, EventParticipant]),
    EmployeesModule,
    NotificationsModule,
    HolidaysModule,
  ],
  controllers: [TeamCalendarController],
  providers: [TeamCalendarService, CalendarReminderService],
})
export class TeamCalendarModule {}
