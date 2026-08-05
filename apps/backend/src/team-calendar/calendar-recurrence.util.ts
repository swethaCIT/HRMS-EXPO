import { RecurrenceType } from './entities/calendar-event.entity';

export interface RecurringEventLike {
  startDateTime: Date;
  endDateTime: Date;
  recurrenceType: RecurrenceType;
  recurrenceEndDate: Date | null;
}

export interface Occurrence {
  start: Date;
  end: Date;
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
// 1 year of DAILY recurrence tops out at ~366 iterations — this guard exists
// purely to bound pathological input, not to constrain normal use.
const MAX_ITERATIONS = 1000;

/**
 * Expands an event's occurrences overlapping [rangeStart, rangeEnd) using the
 * same strict overlap test used for conflict/busy detection:
 * existing.start < range.end AND existing.end > range.start (so back-to-back
 * slots never count as overlapping). Reused for calendar listing, conflict
 * warnings, busy flags, and reminder occurrence lookup so all four agree.
 */
export function expandOccurrences(
  event: RecurringEventLike,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const durationMs =
    event.endDateTime.getTime() - event.startDateTime.getTime();

  if (event.recurrenceType === RecurrenceType.NONE) {
    return event.startDateTime < rangeEnd && event.endDateTime > rangeStart
      ? [{ start: event.startDateTime, end: event.endDateTime }]
      : [];
  }

  const seriesEnd = event.recurrenceEndDate
    ? endOfDay(event.recurrenceEndDate)
    : new Date(event.startDateTime.getTime() + ONE_YEAR_MS);
  const iterCap = seriesEnd < rangeEnd ? seriesEnd : rangeEnd;

  const occurrences: Occurrence[] = [];
  let occStart = new Date(event.startDateTime);
  let guard = 0;
  while (occStart <= iterCap && guard < MAX_ITERATIONS) {
    guard++;
    const occEnd = new Date(occStart.getTime() + durationMs);
    if (occStart < rangeEnd && occEnd > rangeStart) {
      occurrences.push({ start: occStart, end: occEnd });
    }
    occStart = advance(occStart, event.recurrenceType);
  }
  return occurrences;
}

function advance(date: Date, type: RecurrenceType): Date {
  const d = new Date(date);
  switch (type) {
    case RecurrenceType.DAILY:
      d.setDate(d.getDate() + 1);
      break;
    case RecurrenceType.WEEKLY:
      d.setDate(d.getDate() + 7);
      break;
    case RecurrenceType.MONTHLY:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
