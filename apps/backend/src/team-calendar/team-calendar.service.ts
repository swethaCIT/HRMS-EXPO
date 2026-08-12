import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import {
  CalendarEvent,
  EventStatus,
  MeetingMode,
  RecurrenceType,
} from './entities/calendar-event.entity';
import {
  EventParticipant,
  ResponseStatus,
} from './entities/event-participant.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RsvpDto } from './dto/rsvp.dto';
import {
  expandOccurrences,
  endOfDay,
  startOfDay,
} from './calendar-recurrence.util';
import { EmployeesService } from '../employees/employees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { HolidaysService } from '../holidays/holidays.service';

export interface ConflictInfo {
  eventId: string;
  title: string;
  startDateTime: Date;
  endDateTime: Date;
  employeeIds: string[];
}

export interface RangeItem {
  eventId: string | null;
  title: string;
  startDateTime: Date;
  endDateTime: Date;
  meetingMode: MeetingMode | null;
  participantCount: number;
  status: EventStatus | null;
  isHoliday?: boolean;
  holidayId?: string;
  /** Holiday classification (public|optional|company) — only present on holiday rows. */
  type?: string;
  /** Holiday description — only present on holiday rows. */
  description?: string | null;
}

export interface UpcomingItem {
  eventId: string | null;
  title: string;
  startDateTime: Date;
  endDateTime: Date;
  meetingMode: MeetingMode | null;
  status: EventStatus | null;
  isHoliday?: boolean;
  holidayId?: string;
  type?: string;
  description?: string | null;
}

const UPCOMING_HORIZON_DAYS = 30;
const UPCOMING_MAX_RESULTS = 20;
const DEFAULT_RANGE_DAYS = 30;

@Injectable()
export class TeamCalendarService {
  private readonly logger = new Logger(TeamCalendarService.name);

  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepo: Repository<EventParticipant>,
    private readonly employeesService: EmployeesService,
    private readonly notifications: NotificationsService,
    private readonly holidaysService: HolidaysService,
  ) {}

  /* ───────────────────────── Create ───────────────────────── */

  async create(dto: CreateEventDto, userId: string) {
    const organizer = await this.employeesService.findByUserId(userId);
    if (!organizer)
      throw new BadRequestException(
        'No employee profile found for the current user',
      );

    const fields = {
      title: dto.title,
      description: dto.description ?? null,
      startDateTime: new Date(dto.startDateTime),
      endDateTime: new Date(dto.endDateTime),
      meetingMode: dto.meetingMode,
      location: dto.location ?? null,
      meetingLink: dto.meetingLink ?? null,
      recurrenceType: dto.recurrenceType ?? RecurrenceType.NONE,
      recurrenceEndDate: dto.recurrenceEndDate
        ? new Date(dto.recurrenceEndDate)
        : null,
    };
    this.validateEventFields(fields, { enforceFutureStart: true });

    const participantIds = await this.resolveParticipantIds(
      dto.participantIds,
      organizer.id,
    );
    const conflicts = await this.findConflicts(
      participantIds,
      fields.startDateTime,
      fields.endDateTime,
    );

    const event = await this.eventRepo.save(
      this.eventRepo.create({
        ...fields,
        organizerId: organizer.id,
        status: EventStatus.SCHEDULED,
        createdById: userId,
        updatedById: userId,
      }),
    );

    await this.participantRepo.save(
      participantIds.map((employeeId) =>
        this.participantRepo.create({
          eventId: event.eventId,
          employeeId,
          responseStatus: ResponseStatus.PENDING,
        }),
      ),
    );

    const participants = await this.participantRepo.find({
      where: { eventId: event.eventId },
    });
    void this.notifyParticipants(
      participants,
      NotificationType.CALENDAR_INVITE,
      'Meeting invite',
      `You have been invited to "${event.title}".`,
      event.eventId,
    );

    return { success: true, eventId: event.eventId, conflicts };
  }

  /* ───────────────────────── Read ───────────────────────── */

  async findRange(startStr?: string, endStr?: string) {
    const { rangeStart, rangeEnd } = this.resolveRange(startStr, endStr);

    const events = await this.fetchCandidateEvents(rangeStart, rangeEnd, [
      EventStatus.SCHEDULED,
      EventStatus.COMPLETED,
    ]);
    const countMap = await this.countParticipantsByEvent(
      events.map((e) => e.eventId),
    );

    const items: RangeItem[] = [];
    for (const event of events) {
      for (const occ of expandOccurrences(event, rangeStart, rangeEnd)) {
        items.push({
          eventId: event.eventId,
          title: event.title,
          startDateTime: occ.start,
          endDateTime: occ.end,
          meetingMode: event.meetingMode,
          participantCount: countMap.get(event.eventId) ?? 0,
          status: event.status,
        });
      }
    }

    // Holiday overlay: read-only merge into the same list, flagged via isHoliday
    // so clients can render them distinctly without a second request.
    const holidays = await this.holidaysService.findAll();
    for (const holiday of holidays) {
      const date = new Date(holiday.date);
      if (date >= rangeStart && date <= rangeEnd) {
        items.push({
          eventId: null,
          title: holiday.name,
          startDateTime: date,
          endDateTime: date,
          meetingMode: null,
          participantCount: 0,
          status: null,
          isHoliday: true,
          holidayId: holiday.id,
          type: holiday.type,
          description: holiday.description,
        });
      }
    }

    items.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    return items;
  }

  async findOne(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const participants = await this.participantRepo.find({
      where: { eventId },
      order: { createdAt: 'ASC' },
    });

    // Enrich with display names/avatars so clients don't need a round-trip per
    // participant just to render a detail screen.
    // One query for everyone, not one per participant.
    const employeeIds = Array.from(new Set([event.organizerId, ...participants.map((p) => p.employeeId)]));
    const employeeById = await this.employeesService.findManyByIds(employeeIds);
    const nameOf = (id: string) => {
      const e = employeeById.get(id);
      return e ? `${e.firstName} ${e.lastName}`.trim() : undefined;
    };

    return {
      ...event,
      organizerName: nameOf(event.organizerId),
      participants: participants.map((p) => ({
        employeeId: p.employeeId,
        name: nameOf(p.employeeId),
        avatarUrl: employeeById.get(p.employeeId)?.avatarUrl,
        responseStatus: p.responseStatus,
        respondedAt: p.respondedAt,
      })),
    };
  }

  async upcoming(userId: string) {
    const employee = await this.employeesService.findByUserId(userId);
    if (!employee) return [];

    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + UPCOMING_HORIZON_DAYS);

    const events = await this.fetchCandidateEvents(
      now,
      horizon,
      [EventStatus.SCHEDULED],
      { employeeIds: [employee.id] },
    );

    const items: UpcomingItem[] = [];
    for (const event of events) {
      for (const occ of expandOccurrences(event, now, horizon)) {
        items.push({
          eventId: event.eventId,
          title: event.title,
          startDateTime: occ.start,
          endDateTime: occ.end,
          meetingMode: event.meetingMode,
          status: event.status,
        });
      }
    }

    // Holiday overlay, same as findRange(): holidays apply company-wide, so this
    // is intentionally NOT filtered by employeeIds like the meetings above are.
    const holidays = await this.holidaysService.findAll();
    for (const holiday of holidays) {
      const date = new Date(holiday.date);
      if (date >= now && date <= horizon) {
        items.push({
          eventId: null,
          title: holiday.name,
          startDateTime: date,
          endDateTime: date,
          meetingMode: null,
          status: null,
          isHoliday: true,
          holidayId: holiday.id,
          type: holiday.type,
          description: holiday.description,
        });
      }
    }

    items.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    return items.slice(0, UPCOMING_MAX_RESULTS);
  }

  /* ───────────────────────── Update / Cancel ───────────────────────── */

  async update(eventId: string, dto: UpdateEventDto, userId: string) {
    const event = await this.eventRepo.findOne({ where: { eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.createdById !== userId)
      throw new ForbiddenException('Only the organizer can edit this event');
    if (event.status === EventStatus.CANCELLED)
      throw new BadRequestException('Cannot edit a cancelled event');

    const merged = {
      title: dto.title ?? event.title,
      description:
        dto.description !== undefined ? dto.description : event.description,
      startDateTime: dto.startDateTime
        ? new Date(dto.startDateTime)
        : event.startDateTime,
      endDateTime: dto.endDateTime
        ? new Date(dto.endDateTime)
        : event.endDateTime,
      meetingMode: dto.meetingMode ?? event.meetingMode,
      location: dto.location !== undefined ? dto.location : event.location,
      meetingLink:
        dto.meetingLink !== undefined ? dto.meetingLink : event.meetingLink,
      recurrenceType: dto.recurrenceType ?? event.recurrenceType,
      recurrenceEndDate:
        dto.recurrenceEndDate !== undefined
          ? dto.recurrenceEndDate
            ? new Date(dto.recurrenceEndDate)
            : null
          : event.recurrenceEndDate,
    };
    this.validateEventFields(merged, {
      enforceFutureStart: dto.startDateTime !== undefined,
    });

    let mergedParticipantIds: string[] | null = null;
    if (dto.participantIds) {
      mergedParticipantIds = await this.resolveParticipantIds(
        dto.participantIds,
        event.organizerId,
      );
    }

    const conflictCheckIds =
      mergedParticipantIds ??
      (await this.participantRepo.find({ where: { eventId } })).map(
        (p) => p.employeeId,
      );
    const conflicts = await this.findConflicts(
      conflictCheckIds,
      merged.startDateTime,
      merged.endDateTime,
      eventId,
    );

    Object.assign(event, merged, { updatedById: userId });
    await this.eventRepo.save(event);

    if (mergedParticipantIds) {
      const existing = await this.participantRepo.find({ where: { eventId } });
      const existingIds = new Set(existing.map((p) => p.employeeId));
      const newIds = new Set(mergedParticipantIds);
      // The organizer can never be dropped, regardless of what the caller sent.
      const toRemove = existing.filter(
        (p) => !newIds.has(p.employeeId) && p.employeeId !== event.organizerId,
      );
      const toAdd = mergedParticipantIds.filter((id) => !existingIds.has(id));
      if (toRemove.length) await this.participantRepo.remove(toRemove);
      if (toAdd.length) {
        await this.participantRepo.save(
          toAdd.map((employeeId) =>
            this.participantRepo.create({
              eventId,
              employeeId,
              responseStatus: ResponseStatus.PENDING,
            }),
          ),
        );
      }
    }

    const finalParticipants = await this.participantRepo.find({
      where: { eventId },
    });
    void this.notifyParticipants(
      finalParticipants,
      NotificationType.CALENDAR_UPDATE,
      'Meeting updated',
      `"${event.title}" has been updated.`,
      eventId,
    );

    return { ...event, conflicts };
  }

  async cancel(eventId: string, userId: string) {
    const event = await this.eventRepo.findOne({ where: { eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.createdById !== userId)
      throw new ForbiddenException('Only the organizer can cancel this event');
    if (event.status === EventStatus.CANCELLED)
      return { success: true, eventId: event.eventId };

    // Soft-delete only: status flips to CANCELLED, event_participants rows are untouched.
    event.status = EventStatus.CANCELLED;
    event.updatedById = userId;
    await this.eventRepo.save(event);

    const participants = await this.participantRepo.find({
      where: { eventId },
    });
    void this.notifyParticipants(
      participants,
      NotificationType.CALENDAR_CANCEL,
      'Meeting cancelled',
      `"${event.title}" has been cancelled.`,
      eventId,
    );

    return { success: true, eventId: event.eventId };
  }

  /* ───────────────────────── RSVP ───────────────────────── */

  async rsvp(eventId: string, dto: RsvpDto, userId: string) {
    const event = await this.eventRepo.findOne({ where: { eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.SCHEDULED) {
      throw new BadRequestException(
        'Cannot RSVP to a cancelled or completed event',
      );
    }

    const employee = await this.employeesService.findByUserId(userId);
    if (!employee)
      throw new ForbiddenException(
        'No employee profile found for the current user',
      );

    const participant = await this.participantRepo.findOne({
      where: { eventId, employeeId: employee.id },
    });
    if (!participant)
      throw new ForbiddenException('You are not a participant of this event');

    participant.responseStatus = dto.status as unknown as ResponseStatus;
    participant.respondedAt = new Date();
    await this.participantRepo.save(participant);
    return participant;
  }

  /* ───────────────────────── Employee search ───────────────────────── */

  async searchEmployees(
    q?: string,
    page?: number,
    limit?: number,
    startStr?: string,
    endStr?: string,
    excludeEventId?: string,
  ) {
    const result = await this.employeesService.search(q, page, limit);

    let busyMap = new Map<string, boolean>();
    const rangeStart = startStr ? new Date(startStr) : null;
    const rangeEnd = endStr ? new Date(endStr) : null;
    if (
      rangeStart &&
      rangeEnd &&
      !isNaN(rangeStart.getTime()) &&
      !isNaN(rangeEnd.getTime())
    ) {
      // When editing an existing meeting, exclude it from its own conflict
      // check — otherwise every participant already on the meeting shows up
      // "Busy" against the very slot they're already booked into.
      busyMap = await this.getBusyMap(
        result.data.map((e) => e.id),
        rangeStart,
        rangeEnd,
        excludeEventId,
      );
    }

    return {
      data: result.data.map((e) => ({
        employeeId: e.id,
        name: `${e.firstName} ${e.lastName}`.trim(),
        department: e.department,
        designation: e.designation,
        avatarUrl: e.avatarUrl,
        busy: busyMap.get(e.id) ?? false,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /* ───────────────────────── Shared helpers ───────────────────────── */

  private resolveRange(
    startStr?: string,
    endStr?: string,
  ): { rangeStart: Date; rangeEnd: Date } {
    let rangeStart: Date;
    if (startStr) {
      rangeStart = startOfDay(new Date(startStr));
      if (isNaN(rangeStart.getTime()))
        throw new BadRequestException('Invalid start date');
    } else {
      rangeStart = startOfDay(new Date());
    }

    let rangeEnd: Date;
    if (endStr) {
      rangeEnd = endOfDay(new Date(endStr));
      if (isNaN(rangeEnd.getTime()))
        throw new BadRequestException('Invalid end date');
    } else {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + DEFAULT_RANGE_DAYS);
      rangeEnd = endOfDay(d);
    }

    return { rangeStart, rangeEnd };
  }

  private async resolveParticipantIds(
    raw: string[] | undefined,
    organizerId: string,
  ): Promise<string[]> {
    const ids = raw ?? [];
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'participantIds must not contain duplicates',
      );
    }
    const merged = Array.from(new Set([...ids, organizerId]));
    if (merged.length > 50)
      throw new BadRequestException(
        'A meeting can have at most 50 participants',
      );
    if (!(await this.employeesService.existsAll(merged))) {
      throw new BadRequestException('One or more participants were not found');
    }
    return merged;
  }

  private validateEventFields(
    fields: {
      title: string;
      description?: string | null;
      startDateTime: Date;
      endDateTime: Date;
      meetingMode: MeetingMode;
      location?: string | null;
      meetingLink?: string | null;
      recurrenceType: RecurrenceType;
      recurrenceEndDate?: Date | null;
    },
    opts: { enforceFutureStart: boolean },
  ) {
    if (!fields.title || fields.title.length > 100) {
      throw new BadRequestException(
        'Title is required and must be at most 100 characters',
      );
    }
    if (fields.description && fields.description.length > 500) {
      throw new BadRequestException(
        'Description must be at most 500 characters',
      );
    }
    if (
      isNaN(fields.startDateTime.getTime()) ||
      isNaN(fields.endDateTime.getTime())
    ) {
      throw new BadRequestException('Invalid start/end date');
    }
    if (fields.startDateTime >= fields.endDateTime) {
      throw new BadRequestException('startDateTime must be before endDateTime');
    }
    if (
      opts.enforceFutureStart &&
      fields.startDateTime.getTime() < Date.now()
    ) {
      throw new BadRequestException('startDateTime cannot be in the past');
    }
    if (fields.meetingMode === MeetingMode.ONLINE && !fields.meetingLink) {
      throw new BadRequestException(
        'meetingLink is required for an online meeting',
      );
    }
    if (fields.meetingMode === MeetingMode.OFFLINE && !fields.location) {
      throw new BadRequestException(
        'location is required for an offline meeting',
      );
    }
    if (
      fields.recurrenceType !== RecurrenceType.NONE &&
      fields.recurrenceEndDate &&
      fields.recurrenceEndDate < fields.startDateTime
    ) {
      throw new BadRequestException(
        'recurrenceEndDate must be on or after startDateTime',
      );
    }
  }

  /**
   * Fetches events that could possibly produce an occurrence in [rangeStart, rangeEnd):
   * a coarse DB-level prefilter (exact overlap is re-checked afterwards via
   * expandOccurrences, since recurrence can't be expressed in SQL here).
   */
  private async fetchCandidateEvents(
    rangeStart: Date,
    rangeEnd: Date,
    statuses: EventStatus[],
    opts?: { employeeIds?: string[]; excludeEventId?: string },
  ): Promise<CalendarEvent[]> {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.status IN (:...statuses)', { statuses })
      .andWhere('e.startDateTime < :rangeEnd', { rangeEnd })
      .andWhere(
        new Brackets((qb2) => {
          qb2
            .where('e.recurrenceType = :none AND e.endDateTime > :rangeStart', {
              none: RecurrenceType.NONE,
              rangeStart,
            })
            .orWhere(
              'e.recurrenceType != :none AND (e.recurrenceEndDate IS NULL OR e.recurrenceEndDate >= :rangeStartDay)',
              {
                none: RecurrenceType.NONE,
                // `recurrenceEndDate` is a plain `date` column (implicitly
                // midnight) — comparing it against a timestamp with a
                // time-of-day component would drop the series the moment
                // any time passes on its last valid day. Compare date-to-date.
                rangeStartDay: startOfDay(rangeStart),
              },
            );
        }),
      );

    if (opts?.employeeIds?.length) {
      qb.andWhere(
        new Brackets((qb2) => {
          qb2
            .where('e.organizerId IN (:...employeeIds)', {
              employeeIds: opts.employeeIds,
            })
            .orWhere(
              'EXISTS (SELECT 1 FROM event_participants p WHERE p."eventId" = e."eventId" AND p."employeeId" IN (:...employeeIds))',
              { employeeIds: opts.employeeIds },
            );
        }),
      );
    }

    if (opts?.excludeEventId) {
      qb.andWhere('e.eventId != :excludeEventId', {
        excludeEventId: opts.excludeEventId,
      });
    }

    return qb.getMany();
  }

  private async countParticipantsByEvent(
    eventIds: string[],
  ): Promise<Map<string, number>> {
    if (!eventIds.length) return new Map();
    const rows = await this.participantRepo
      .createQueryBuilder('p')
      .select('p.eventId', 'eventId')
      .addSelect('COUNT(*)', 'count')
      .where('p.eventId IN (:...eventIds)', { eventIds })
      .groupBy('p.eventId')
      .getRawMany<{ eventId: string; count: string }>();
    return new Map(rows.map((r) => [r.eventId, Number(r.count)]));
  }

  /**
   * The single source of truth for "does employee X have a scheduled meeting
   * overlapping [rangeStart, rangeEnd)" — used for both create/edit conflict
   * warnings and the employee-search busy flag, so they can never disagree.
   * Cancelled meetings are excluded by construction (SCHEDULED-only query).
   */
  private async findConflicts(
    employeeIds: string[],
    rangeStart: Date,
    rangeEnd: Date,
    excludeEventId?: string,
  ): Promise<ConflictInfo[]> {
    if (!employeeIds.length) return [];
    const events = await this.fetchCandidateEvents(
      rangeStart,
      rangeEnd,
      [EventStatus.SCHEDULED],
      { employeeIds, excludeEventId },
    );
    if (!events.length) return [];

    const eventIds = events.map((e) => e.eventId);
    const relevantParticipants = await this.participantRepo.find({
      where: { eventId: In(eventIds), employeeId: In(employeeIds) },
    });
    const byEvent = new Map<string, Set<string>>();
    for (const p of relevantParticipants) {
      if (!byEvent.has(p.eventId)) byEvent.set(p.eventId, new Set());
      byEvent.get(p.eventId)!.add(p.employeeId);
    }

    const conflicts: ConflictInfo[] = [];
    for (const event of events) {
      const occurrences = expandOccurrences(event, rangeStart, rangeEnd);
      if (!occurrences.length) continue;

      const involved = byEvent.get(event.eventId) ?? new Set<string>();
      if (employeeIds.includes(event.organizerId))
        involved.add(event.organizerId);
      if (!involved.size) continue;

      conflicts.push({
        eventId: event.eventId,
        title: event.title,
        startDateTime: occurrences[0].start,
        endDateTime: occurrences[0].end,
        employeeIds: Array.from(involved),
      });
    }
    return conflicts;
  }

  private async getBusyMap(
    employeeIds: string[],
    rangeStart: Date,
    rangeEnd: Date,
    excludeEventId?: string,
  ): Promise<Map<string, boolean>> {
    const map = new Map(employeeIds.map((id) => [id, false]));
    const conflicts = await this.findConflicts(
      employeeIds,
      rangeStart,
      rangeEnd,
      excludeEventId,
    );
    for (const c of conflicts)
      for (const id of c.employeeIds) map.set(id, true);
    return map;
  }

  /** Notify every participant, resolving employee -> user id. Never breaks the calling create/update/cancel flow. */
  private async notifyParticipants(
    participants: EventParticipant[],
    type: NotificationType,
    title: string,
    body: string,
    eventId: string,
  ): Promise<void> {
    try {
      await Promise.all(
        participants.map(async (p) => {
          const employee = await this.employeesService
            .findOne(p.employeeId)
            .catch(() => null);
          const recipientUserId = employee?.user?.id;
          if (!recipientUserId) return;
          const notification = await this.notifications.createPendingForUser(
            recipientUserId,
            title,
            body,
            type,
            { eventId },
          );
          await this.notifications.dispatch(notification);
        }),
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to notify participants for event ${eventId}: ${err?.message}`,
      );
    }
  }
}
