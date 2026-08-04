/**
 * Team Calendar demo data — additional employees + a realistic spread of
 * calendar_events/event_participants for manual verification on a device.
 *
 * Run with:  npm run seed:calendar --workspace=apps/backend
 * Partially idempotent: employees are keyed by email (won't duplicate).
 * The calendar events themselves are re-created on every run (deleted by
 * title first) since one of them is deliberately "starts in 10 minutes
 * from now" and must be recomputed relative to the actual run time.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { User, UserRole } from './users/entities/user.entity';
import { Employee, EmploymentType, EmploymentStatus } from './employees/entities/employee.entity';
import { CalendarEvent, EventStatus, MeetingMode, RecurrenceType } from './team-calendar/entities/calendar-event.entity';
import { EventParticipant, ResponseStatus } from './team-calendar/entities/event-participant.entity';

dotenv.config();

const PASSWORD = 'Admin@123';

interface NewPerson {
  email: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  designation: string;
}

const NEW_PEOPLE: NewPerson[] = [
  { email: 'priya.sharma@hrms.com', employeeId: 'EMP006', firstName: 'Priya', lastName: 'Sharma', department: 'Marketing', designation: 'Marketing Lead' },
  { email: 'karthik.nair@hrms.com', employeeId: 'EMP007', firstName: 'Karthik', lastName: 'Nair', department: 'Sales', designation: 'Sales Executive' },
  { email: 'sneha.thomas@hrms.com', employeeId: 'EMP008', firstName: 'Sneha', lastName: 'Thomas', department: 'Finance', designation: 'Financial Analyst' },
  { email: 'vikram.rao@hrms.com', employeeId: 'EMP009', firstName: 'Vikram', lastName: 'Rao', department: 'Design', designation: 'Product Designer' },
  { email: 'ananya.gupta@hrms.com', employeeId: 'EMP010', firstName: 'Ananya', lastName: 'Gupta', department: 'Engineering', designation: 'QA Engineer' },
];

/** Titles of the demo meetings this script owns — deleted + re-created on every run. */
const SEEDED_TITLES = [
  'Product Roadmap Review',
  'Design Sync',
  'Engineering Standup',
  'Quick Sync',
  'Old Budget Review',
  'All Hands Planning',
];

async function main() {
  const url = process.env.DATABASE_URL;
  const entities = [User, Employee, CalendarEvent, EventParticipant];

  const ds = url
    ? new DataSource({ type: 'postgres', url, ssl: { rejectUnauthorized: false }, entities, synchronize: true })
    : new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'hrms_user',
        password: process.env.DB_PASSWORD || 'hrms_password',
        database: process.env.DB_NAME || 'hrms_db',
        entities,
        synchronize: true,
      });

  await ds.initialize();
  console.log('✅ Connected + schema synced');

  const userRepo = ds.getRepository(User);
  const employeeRepo = ds.getRepository(Employee);
  const eventRepo = ds.getRepository(CalendarEvent);
  const participantRepo = ds.getRepository(EventParticipant);

  const hashed = await bcrypt.hash(PASSWORD, 10);

  /* ── Extra employees (idempotent, keyed by email) ── */
  for (const p of NEW_PEOPLE) {
    let user = await userRepo.findOne({ where: { email: p.email } });
    if (!user) {
      user = await userRepo.save(userRepo.create({ email: p.email, password: hashed, role: UserRole.EMPLOYEE, isActive: true }));
      console.log(`✅ user ${p.email}`);
    }
    let emp = await employeeRepo.findOne({ where: { employeeId: p.employeeId } });
    if (!emp) {
      emp = await employeeRepo.save(employeeRepo.create({
        user,
        employeeId: p.employeeId,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: '+91 90000 0' + p.employeeId.slice(-2),
        department: p.department,
        designation: p.designation,
        dateOfJoining: new Date('2024-03-01'),
        employmentType: EmploymentType.FULL_TIME,
        status: EmploymentStatus.ACTIVE,
      }));
      console.log(`   ↳ employee ${p.employeeId} (${p.firstName} ${p.lastName}, ${p.department})`);
    }
  }

  /* ── Resolve everyone's Employee row by employeeId code ── */
  const byCode = async (code: string) => {
    const e = await employeeRepo.findOne({ where: { employeeId: code }, relations: { user: true } });
    if (!e) throw new Error(`Seed employee ${code} not found — run npm run seed first.`);
    return e;
  };
  const admin = await byCode('EMP001'); // admin@hrms.com
  const hr = await byCode('EMP002'); // hr@hrms.com
  const manager = await byCode('EMP003'); // manager@hrms.com
  const rahulOther = await byCode('EMP004'); // swethas.aiml2022@citchennai.net
  const employeeUser = await byCode('EMP005'); // employee@hrms.com
  const priya = await byCode('EMP006');
  const karthik = await byCode('EMP007');
  const sneha = await byCode('EMP008');
  const vikram = await byCode('EMP009');
  const ananya = await byCode('EMP010');

  /* ── Clear this script's previous run so re-running stays deterministic ── */
  const stale = await eventRepo.find({ where: SEEDED_TITLES.map((title) => ({ title })) });
  if (stale.length) {
    await participantRepo.delete({ eventId: stale.map((e) => e.eventId) as any });
    await eventRepo.remove(stale);
    console.log(`🧹 removed ${stale.length} previously-seeded demo event(s)`);
  }

  const now = new Date();
  const at = (daysFromNow: number, hour: number, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  async function makeEvent(
    fields: {
      title: string;
      description?: string;
      start: Date;
      end: Date;
      organizer: Employee;
      mode: MeetingMode;
      location?: string;
      link?: string;
      recurrenceType?: RecurrenceType;
      recurrenceEndDate?: Date;
      status?: EventStatus;
    },
    participants: { emp: Employee; status: ResponseStatus }[],
  ) {
    const event = await eventRepo.save(eventRepo.create({
      title: fields.title,
      description: fields.description ?? null,
      organizerId: fields.organizer.id,
      startDateTime: fields.start,
      endDateTime: fields.end,
      meetingMode: fields.mode,
      location: fields.location ?? null,
      meetingLink: fields.link ?? null,
      recurrenceType: fields.recurrenceType ?? RecurrenceType.NONE,
      recurrenceEndDate: fields.recurrenceEndDate ?? null,
      status: fields.status ?? EventStatus.SCHEDULED,
      createdById: fields.organizer.user.id,
      updatedById: fields.organizer.user.id,
    }));
    await participantRepo.save(
      participants.map((p) => participantRepo.create({
        eventId: event.eventId,
        employeeId: p.emp.id,
        responseStatus: p.status,
        respondedAt: p.status === ResponseStatus.PENDING ? null : new Date(),
      })),
    );
    console.log(`✅ ${event.status === EventStatus.CANCELLED ? '(cancelled) ' : ''}${fields.title} — ${participants.length} participant(s)`);
    return event;
  }

  // 1) One-time meeting this week — overlaps #6 for manager/hr/rahulOther (busy-flag demo).
  await makeEvent(
    {
      title: 'Product Roadmap Review', description: 'Q3 roadmap walkthrough with engineering leads.',
      start: at(1, 10, 0), end: at(1, 11, 0), organizer: manager, mode: MeetingMode.ONLINE, link: 'https://meet.hrms.com/roadmap-q3',
    },
    [
      { emp: manager, status: ResponseStatus.PENDING },
      { emp: hr, status: ResponseStatus.ACCEPTED },
      { emp: rahulOther, status: ResponseStatus.DECLINED },
      { emp: vikram, status: ResponseStatus.TENTATIVE },
    ],
  );

  // 2) One-time meeting this week.
  await makeEvent(
    {
      title: 'Design Sync', description: 'Review the new checkout mockups.',
      start: at(2, 15, 0), end: at(2, 16, 0), organizer: vikram, mode: MeetingMode.OFFLINE, location: 'Design Studio, 3rd Floor',
    },
    [
      { emp: vikram, status: ResponseStatus.PENDING },
      { emp: sneha, status: ResponseStatus.ACCEPTED },
      { emp: manager, status: ResponseStatus.ACCEPTED },
    ],
  );

  // 3) Recurring weekly meeting (started last week, repeats every week through early October).
  await makeEvent(
    {
      title: 'Engineering Standup', description: 'Weekly sync for the engineering team.',
      start: at(-7, 9, 0), end: at(-7, 9, 15), organizer: manager, mode: MeetingMode.HYBRID,
      location: 'Engineering Bay', link: 'https://meet.hrms.com/eng-standup',
      recurrenceType: RecurrenceType.WEEKLY, recurrenceEndDate: at(63, 9, 15),
    },
    [
      { emp: manager, status: ResponseStatus.PENDING },
      { emp: rahulOther, status: ResponseStatus.ACCEPTED },
      { emp: employeeUser, status: ResponseStatus.ACCEPTED },
      { emp: vikram, status: ResponseStatus.TENTATIVE },
      { emp: ananya, status: ResponseStatus.ACCEPTED },
    ],
  );

  // 4) Starts in ~7 minutes from right now — for the reminder cron (fires ≤10 min out).
  const quickStart = new Date(now.getTime() + 7 * 60 * 1000);
  const quickEnd = new Date(now.getTime() + 27 * 60 * 1000);
  await makeEvent(
    {
      title: 'Quick Sync', description: 'Fast check-in on the release checklist.',
      start: quickStart, end: quickEnd, organizer: employeeUser, mode: MeetingMode.ONLINE, link: 'https://meet.hrms.com/quick-sync',
    },
    [
      { emp: employeeUser, status: ResponseStatus.PENDING },
      { emp: manager, status: ResponseStatus.PENDING },
      { emp: hr, status: ResponseStatus.PENDING },
    ],
  );

  // 5) Already-cancelled meeting — must be excluded from GET /events, /upcoming, and busy checks.
  await makeEvent(
    {
      title: 'Old Budget Review', description: 'Superseded by the finance offsite.',
      start: at(-1, 14, 0), end: at(-1, 15, 0), organizer: hr, mode: MeetingMode.OFFLINE, location: 'Finance Room',
      status: EventStatus.CANCELLED,
    },
    [
      { emp: hr, status: ResponseStatus.PENDING },
      { emp: admin, status: ResponseStatus.ACCEPTED },
      { emp: manager, status: ResponseStatus.DECLINED },
    ],
  );

  // 6) Many participants, full RSVP variety, overlaps #1 by 30 min for manager/hr/rahulOther.
  await makeEvent(
    {
      title: 'All Hands Planning', description: 'Company-wide planning session for the next quarter.',
      start: at(1, 10, 30), end: at(1, 12, 0), organizer: admin, mode: MeetingMode.HYBRID,
      location: 'Main Auditorium', link: 'https://meet.hrms.com/all-hands',
    },
    [
      { emp: admin, status: ResponseStatus.PENDING },
      { emp: manager, status: ResponseStatus.ACCEPTED },
      { emp: hr, status: ResponseStatus.DECLINED },
      { emp: rahulOther, status: ResponseStatus.TENTATIVE },
      { emp: employeeUser, status: ResponseStatus.ACCEPTED },
      { emp: sneha, status: ResponseStatus.PENDING },
      { emp: karthik, status: ResponseStatus.DECLINED },
      { emp: priya, status: ResponseStatus.TENTATIVE },
    ],
  );

  await ds.destroy();
  console.log('\n🎉 Calendar seed complete.');
  console.log(`   Quick Sync starts at ${quickStart.toISOString()} (now: ${now.toISOString()})`);
}

main().catch((err) => {
  console.error('❌ Calendar seed failed:', err);
  process.exit(1);
});
