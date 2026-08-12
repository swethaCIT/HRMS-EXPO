/* ════════════════════════════════════════════════════════
   Calendar — shared design tokens, enums and date helpers.
   Mirrors apps/backend/src/team-calendar's enums; reuses the app's own
   palette (T from data/managerData) rather than inventing new colors.
   ════════════════════════════════════════════════════════ */

import { T } from '../../data/managerData';
import { IconName } from '../../components/Icon';
import { MeetingMode, EventStatus, ResponseStatus, RecurrenceType, HolidayType } from '../../types/calendar';

export { T };

/* Holiday type palette — public = indigo, optional = amber, company = green.
 * Matches the retired standalone Holidays screen exactly, so the visual
 * language carries over into the unified calendar. */
export const HOLIDAY_TYPE_META: Record<HolidayType, { label: string; bg: string; fg: string; solid: string }> = {
  public: { label: 'Public', bg: '#EEF2FF', fg: T.primary, solid: T.primary },
  optional: { label: 'Optional', bg: T.amber.bg, fg: T.amber.fg, solid: T.amber.solid },
  company: { label: 'Company', bg: T.green.bg, fg: T.green.fg, solid: T.green.solid },
};
export const HOLIDAY_TYPE_OPTIONS: HolidayType[] = ['public', 'optional', 'company'];

export const MODE_META: Record<MeetingMode, { label: string; icon: IconName; bg: string; fg: string; solid: string }> = {
  Online: { label: 'Online', icon: 'video', bg: T.blue.bg, fg: T.blue.fg, solid: T.blue.solid },
  Offline: { label: 'Offline', icon: 'map-pin', bg: T.green.bg, fg: T.green.fg, solid: T.green.solid },
  Hybrid: { label: 'Hybrid', icon: 'users', bg: T.purple.bg, fg: T.purple.fg, solid: T.purple.solid },
};

export const EVENT_STATUS_META: Record<EventStatus, { label: string; bg: string; fg: string; solid: string }> = {
  SCHEDULED: { label: 'Scheduled', bg: T.blue.bg, fg: T.blue.fg, solid: T.blue.solid },
  CANCELLED: { label: 'Cancelled', bg: T.red.bg, fg: T.red.fg, solid: T.red.solid },
  COMPLETED: { label: 'Completed', bg: T.green.bg, fg: T.green.fg, solid: T.green.solid },
};

export const RSVP_META: Record<ResponseStatus, { label: string; bg: string; fg: string; solid: string }> = {
  Pending: { label: 'Pending', bg: T.amber.bg, fg: T.amber.fg, solid: T.amber.solid },
  Accepted: { label: 'Accepted', bg: T.green.bg, fg: T.green.fg, solid: T.green.solid },
  Declined: { label: 'Declined', bg: T.red.bg, fg: T.red.fg, solid: T.red.solid },
  Tentative: { label: 'Tentative', bg: T.amber.bg, fg: T.amber.fg, solid: T.amber.solid },
};

export const RECURRENCE_META: Record<RecurrenceType, string> = {
  NONE: 'Never',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};
export const RECURRENCE_OPTIONS: RecurrenceType[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'];

/* Calendar dots — meetings = blue, holidays = amber (per spec). */
export const DOT_MEETING = T.blue.solid;
export const DOT_HOLIDAY = T.amber.solid;
export const MAX_DOTS_PER_DAY = 3;

export const REMINDER_LABEL = '10 min before';

/* ── Date helpers ── */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' in local time (never UTC — avoids off-by-one day drift). */
export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 6×7 month grid including leading/trailing filler days from adjacent months. */
export function calendarGrid(year: number, month: number): { date: Date; cur: boolean }[] {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const prevTotal = new Date(year, month, 0).getDate();
  const days: { date: Date; cur: boolean }[] = [];
  for (let i = first - 1; i >= 0; i--) days.push({ date: new Date(year, month - 1, prevTotal - i), cur: false });
  for (let d = 1; d <= total; d++) days.push({ date: new Date(year, month, d), cur: true });
  let nx = 1;
  while (days.length < 42) days.push({ date: new Date(year, month + 1, nx++), cur: false });
  return days;
}

export function fmtMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  catch { return iso; }
}

export function fmtWeekday(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { weekday: 'long' }); }
  catch { return ''; }
}

export function fmtDateLong(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return iso; }
}

export function fmtDateShort(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

export function fmtTimeRange(startIso: string, endIso: string): string {
  return `${fmtTime(startIso)} – ${fmtTime(endIso)}`;
}
