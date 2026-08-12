/** Mirrors apps/backend/src/team-calendar — keep these in sync with the entity enums. */

export type MeetingMode = 'Online' | 'Offline' | 'Hybrid';
export type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type EventStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
export type ResponseStatus = 'Pending' | 'Accepted' | 'Declined' | 'Tentative';
/** Settable subset of ResponseStatus — "Pending" is only ever the initial default. */
export type RsvpStatus = 'Accepted' | 'Declined' | 'Tentative';
/** Mirrors the Holiday entity's `type` column (stored as a plain string server-side). */
export type HolidayType = 'public' | 'optional' | 'company';

/** One row from GET /calendar/events?start=&end= — a real meeting occurrence or a merged holiday. */
export interface CalendarItem {
  eventId: string | null;
  title: string;
  startDateTime: string;
  endDateTime: string;
  meetingMode: MeetingMode | null;
  participantCount: number;
  status: EventStatus | null;
  isHoliday?: boolean;
  holidayId?: string;
  /** Only present when isHoliday is true. */
  type?: HolidayType;
  description?: string | null;
}

/** One row from GET /calendar/upcoming — a real meeting occurrence or a merged holiday. */
export interface UpcomingItem {
  eventId: string | null;
  title: string;
  startDateTime: string;
  endDateTime: string;
  meetingMode: MeetingMode | null;
  status: EventStatus | null;
  isHoliday?: boolean;
  holidayId?: string;
  /** Only present when isHoliday is true. */
  type?: HolidayType;
  description?: string | null;
}

/** A holiday as returned by GET /holidays. */
export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
  description?: string | null;
}

export interface ConflictInfo {
  eventId: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  employeeIds: string[];
}

export interface ParticipantDetail {
  employeeId: string;
  name?: string;
  avatarUrl?: string;
  responseStatus: ResponseStatus;
  respondedAt: string | null;
}

/** Full row from GET /calendar/events/:id. */
export interface MeetingDetail {
  eventId: string;
  title: string;
  description: string | null;
  organizerId: string;
  organizerName?: string;
  startDateTime: string;
  endDateTime: string;
  meetingMode: MeetingMode;
  location: string | null;
  meetingLink: string | null;
  recurrenceType: RecurrenceType;
  recurrenceEndDate: string | null;
  status: EventStatus;
  createdById: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  participants: ParticipantDetail[];
}

/** Body for POST /calendar/events and PUT /calendar/events/:id. */
export interface MeetingFormPayload {
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  meetingMode: MeetingMode;
  location?: string;
  meetingLink?: string;
  recurrenceType?: RecurrenceType;
  recurrenceEndDate?: string;
  participantIds?: string[];
}

/** One row from GET /calendar/employees/search. */
export interface ParticipantSearchResult {
  employeeId: string;
  name: string;
  department?: string;
  designation?: string;
  avatarUrl?: string;
  busy: boolean;
}
