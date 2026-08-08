import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Brackets, In, Repository } from 'typeorm';
import {
  CalendarEvent,
  EventStatus,
  RecurrenceType,
} from './entities/calendar-event.entity';
import {
  EventParticipant,
  ResponseStatus,
} from './entities/event-participant.entity';
import { expandOccurrences, Occurrence, startOfDay } from './calendar-recurrence.util';
import { EmployeesService } from '../employees/employees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

const REMINDER_WINDOW_MINUTES = 10;

@Injectable()
export class CalendarReminderService {
  private readonly logger = new Logger(CalendarReminderService.name);
  private running = false;

  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepo: Repository<EventParticipant>,
    private readonly employeesService: EmployeesService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Every minute: find SCHEDULED meetings (including recurring series) with an
   * occurrence starting in the next 10 minutes, and send a Reminder to every
   * participant who hasn't declined and hasn't already been reminded for that
   * specific occurrence. Guarded against overlapping runs since a slow scan
   * (many events/participants) could still be in flight at the next tick.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendUpcomingReminders(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const windowEnd = new Date(
        now.getTime() + REMINDER_WINDOW_MINUTES * 60 * 1000,
      );

      const events = await this.eventRepo
        .createQueryBuilder('e')
        .where('e.status = :status', { status: EventStatus.SCHEDULED })
        .andWhere('e.startDateTime <= :windowEnd', { windowEnd })
        .andWhere(
          new Brackets((qb) => {
            qb.where('e.recurrenceType = :none AND e.startDateTime >= :now', {
              none: RecurrenceType.NONE,
              now,
            }).orWhere(
              'e.recurrenceType != :none AND (e.recurrenceEndDate IS NULL OR e.recurrenceEndDate >= :today)',
              {
                none: RecurrenceType.NONE,
                // `recurrenceEndDate` is a plain `date` column (implicitly
                // midnight). Comparing it against `now` (which carries a
                // time-of-day) would drop the series from this scan the
                // moment any time passes past midnight on its last day —
                // silently skipping that final occurrence's reminder for
                // nearly the whole day it's actually due. Compare date-to-date.
                today: startOfDay(now),
              },
            );
          }),
        )
        .getMany();

      // Work out which events actually have an occurrence in the window first,
      // then fetch all their participants and all those employees in two
      // queries. This used to issue one employee lookup per participant per
      // event on every single tick.
      const due = events
        .map((event) => ({ event, occurrence: expandOccurrences(event, now, windowEnd)[0] }))
        .filter((x): x is { event: CalendarEvent; occurrence: Occurrence } => !!x.occurrence);
      if (!due.length) return;

      const participants = await this.participantRepo.find({
        where: { eventId: In(due.map((d) => d.event.eventId)) },
      });
      const eligible = participants.filter((p) => p.responseStatus !== ResponseStatus.DECLINED);
      const employeeById = await this.employeesService.findManyByIds(eligible.map((p) => p.employeeId));

      for (const { event, occurrence } of due) {
        for (const participant of eligible.filter((p) => p.eventId === event.eventId)) {
          await this.sendReminderIfNeeded(event, occurrence, participant, employeeById.get(participant.employeeId));
        }
      }
    } catch (err: any) {
      this.logger.error(`Reminder scan failed: ${err?.message}`);
    } finally {
      this.running = false;
    }
  }

  private async sendReminderIfNeeded(
    event: CalendarEvent,
    occurrence: Occurrence,
    participant: EventParticipant,
    employee?: { user?: { id?: string } } | null,
  ): Promise<void> {
    try {
      const userId = employee?.user?.id;
      if (!userId) return;

      const alreadySent = await this.notifications.reminderAlreadySent(
        userId,
        event.eventId,
        occurrence.start,
      );
      if (alreadySent) return;

      const notification = await this.notifications.createPendingForUser(
        userId,
        `Reminder: ${event.title}`,
        `"${event.title}" starts at ${occurrence.start.toISOString()}.`,
        NotificationType.CALENDAR_REMINDER,
        { eventId: event.eventId, occurrenceAt: occurrence.start },
      );
      await this.notifications.dispatch(notification);
    } catch (err: any) {
      this.logger.error(
        `Failed to send reminder for event ${event.eventId} to employee ${participant.employeeId}: ${err?.message}`,
      );
    }
  }
}
