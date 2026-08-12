import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Employee, EmploymentStatus } from '../employees/entities/employee.entity';
import { Leave, LeaveStatus } from '../leaves/entities/leave.entity';
import { Attendance, AttendanceStatus } from '../attendance/entities/attendance.entity';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CACHE_KEY = 'analytics:summary';
const CACHE_TTL = 60_000; // 60s — the dashboard tolerates minute-old numbers.
const DIRECTORY_KEY = 'analytics:directory';
const NEW_JOINER_DAYS = 60;

/** Where someone is today. Mirrors the mobile `Presence` union. */
export type Presence = 'in' | 'remote' | 'leave' | 'out';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Employee) private readonly empRepo: Repository<Employee>,
    @InjectRepository(Leave) private readonly leaveRepo: Repository<Leave>,
    @InjectRepository(Attendance) private readonly attRepo: Repository<Attendance>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private groupCount<T>(rows: T[], key: (r: T) => string) {
    const m: Record<string, number> = {};
    for (const r of rows) { const k = key(r) || 'Other'; m[k] = (m[k] || 0) + 1; }
    return Object.entries(m).map(([label, value]) => ({ label, value }));
  }

  private dateKey(d: any): string {
    if (typeof d === 'string') return d.slice(0, 10);
    try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; }
  }

  /** Local calendar date, matching how attendance rows are written. */
  private todayKey(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  private fullName(e: Employee) {
    return `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.employeeId;
  }

  /**
   * Where each employee is today, from real records: an approved leave covering
   * today wins, otherwise today's attendance row decides office vs WFH, and no
   * record at all means not in yet.
   */
  private presenceOf(
    employeeId: string,
    todayAttendance: Attendance[],
    activeLeaveEmployeeIds: Set<string>,
  ): Presence {
    if (activeLeaveEmployeeIds.has(employeeId)) return 'leave';
    const rec = todayAttendance.find((a) => (a as any).employeeId === employeeId || a.employee?.id === employeeId);
    if (!rec) return 'out';
    return rec.status === AttendanceStatus.WORK_FROM_HOME ? 'remote' : 'in';
  }

  /**
   * Cached summary. Opened by every manager/HR user, so it must not re-scan
   * tables per request: cached 60s, attendance bounded to the last 7 days (it
   * grows one row per employee per day) and leaves to the current year.
   */
  async summary() {
    const cached = await this.cache.get(CACHE_KEY);
    if (cached) return cached;

    const now = new Date();
    const year = now.getFullYear();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sinceDate = sevenDaysAgo.toISOString().slice(0, 10);
    const yearStart = `${year}-01-01`;
    const todayKey = this.todayKey();

    const [employees, leaves, attendance] = await Promise.all([
      this.empRepo.find(),
      this.leaveRepo.find({ where: { startDate: MoreThanOrEqual(yearStart) as any }, relations: { employee: true } }),
      this.attRepo.find({ where: { date: MoreThanOrEqual(sinceDate) as any }, relations: { employee: true } }),
    ]);

    const active = employees.filter((e) => e.status === EmploymentStatus.ACTIVE);
    const headcount = active.length;

    /* ── Leave distribution (approved, this year) by type ── */
    const leaveMap: Record<string, number> = {};
    for (const l of leaves) {
      if (this.dateKey(l.startDate).slice(0, 4) === String(year) && l.status === LeaveStatus.APPROVED) {
        leaveMap[l.type] = (leaveMap[l.type] || 0) + (Number(l.totalDays) || 0);
      }
    }
    const leaveDistribution = Object.entries(leaveMap).map(([type, value]) => ({ label: cap(type), value }));

    /* ── Attendance trend — last 7 days, % of headcount with a record ── */
    const attendanceTrend: number[] = [];
    const attendanceLabels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const present = attendance.filter((a) => this.dateKey(a.date) === key).length;
      attendanceTrend.push(headcount ? Math.round((present / headcount) * 100) : 0);
      attendanceLabels.push(DAY[d.getDay()]);
    }
    const nonZero = attendanceTrend.filter((v) => v > 0);
    const avgAttendance = nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;

    /* ── Presence today — replaces the hardcoded "team pulse" ── */
    const todayAttendance = attendance.filter((a) => this.dateKey(a.date) === todayKey);
    const onLeaveToday = new Set(
      leaves
        .filter((l) => l.status === LeaveStatus.APPROVED)
        .filter((l) => this.dateKey(l.startDate) <= todayKey && this.dateKey(l.endDate) >= todayKey)
        .map((l) => l.employee?.id)
        .filter((id): id is string => !!id),
    );
    const presenceCounts = { in: 0, remote: 0, leave: 0, out: 0 };
    for (const e of active) presenceCounts[this.presenceOf(e.id, todayAttendance, onLeaveToday)]++;
    const availableToday = presenceCounts.in + presenceCounts.remote;

    /* ── New joiners (last 60 days) ── */
    const joinCutoff = new Date(now.getTime() - NEW_JOINER_DAYS * 86_400_000);
    const newJoiners = active
      .filter((e) => e.dateOfJoining && new Date(e.dateOfJoining) >= joinCutoff)
      .sort((a, b) => +new Date(b.dateOfJoining) - +new Date(a.dateOfJoining))
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        name: this.fullName(e),
        designation: e.designation ?? null,
        department: e.department ?? null,
        dateOfJoining: this.dateKey(e.dateOfJoining),
      }));

    /* ── Celebrations this month: birthdays and work anniversaries ── */
    const thisMonth = now.getMonth();
    const celebrations = [
      ...active
        .filter((e) => e.dateOfBirth && new Date(e.dateOfBirth).getMonth() === thisMonth)
        .map((e) => ({
          kind: 'birthday' as const,
          name: this.fullName(e),
          department: e.department ?? null,
          day: new Date(e.dateOfBirth).getDate(),
          years: null as number | null,
        })),
      ...active
        .filter((e) => {
          if (!e.dateOfJoining) return false;
          const d = new Date(e.dateOfJoining);
          return d.getMonth() === thisMonth && d.getFullYear() < year;
        })
        .map((e) => ({
          kind: 'anniversary' as const,
          name: this.fullName(e),
          department: e.department ?? null,
          day: new Date(e.dateOfJoining).getDate(),
          years: year - new Date(e.dateOfJoining).getFullYear(),
        })),
    ].sort((a, b) => a.day - b.day);

    /* ── Attrition: separations per month this year, and the rate ── */
    const separated = employees.filter(
      (e) => e.status === EmploymentStatus.RESIGNED || e.status === EmploymentStatus.TERMINATED,
    );
    const attritionByMonth = MONTH.map((label, idx) => ({
      label,
      value: separated.filter((e) => {
        // No separation-date column exists, so updatedAt is the best available
        // proxy for when the status changed. Flagged so nobody reads it as exact.
        const d = e.updatedAt ? new Date(e.updatedAt) : null;
        return !!d && d.getFullYear() === year && d.getMonth() === idx;
      }).length,
    })).slice(0, now.getMonth() + 1);
    const attritionRate = employees.length
      ? Math.round((separated.length / employees.length) * 1000) / 10
      : 0;

    const result = {
      generatedAt: now.toISOString(),
      headcount,
      totalRecords: employees.length,
      departments: new Set(active.map((e) => e.department || 'General')).size,
      headcountByDept: this.groupCount(active, (e) => e.department || 'General'),
      genderSplit: this.groupCount(active, (e: any) => e.gender || 'Not disclosed'),
      leaveDistribution,
      attendanceTrend,
      attendanceLabels,
      avgAttendance,
      leaveDaysApproved: Object.values(leaveMap).reduce((a, b) => a + b, 0),
      presence: {
        ...presenceCounts,
        total: headcount,
        available: availableToday,
        availablePct: headcount ? Math.round((availableToday / headcount) * 100) : 0,
      },
      newJoiners,
      celebrations,
      attrition: { byMonth: attritionByMonth, separated: separated.length, ratePct: attritionRate, dateBasis: 'updatedAt (approximate)' },
    };

    await this.cache.set(CACHE_KEY, result, CACHE_TTL);
    return result;
  }

  /**
   * Employee directory with today's real presence — what the manager's Team
   * screen and HR's People screen need in order to stop rendering fixtures.
   */
  async directory() {
    const cached = await this.cache.get(DIRECTORY_KEY);
    if (cached) return cached;

    const todayKey = this.todayKey();
    const year = new Date().getFullYear();
    const [employees, todayAttendance, leaves] = await Promise.all([
      this.empRepo.find({ order: { employeeId: 'ASC' } }),
      this.attRepo.find({ where: { date: todayKey as any }, relations: { employee: true } }),
      this.leaveRepo.find({ where: { startDate: MoreThanOrEqual(`${year}-01-01`) as any }, relations: { employee: true } }),
    ]);

    const onLeaveToday = new Set(
      leaves
        .filter((l) => l.status === LeaveStatus.APPROVED)
        .filter((l) => this.dateKey(l.startDate) <= todayKey && this.dateKey(l.endDate) >= todayKey)
        .map((l) => l.employee?.id)
        .filter((id): id is string => !!id),
    );
    const pendingByEmployee: Record<string, number> = {};
    for (const l of leaves) {
      if (l.status !== LeaveStatus.PENDING || !l.employee?.id) continue;
      pendingByEmployee[l.employee.id] = (pendingByEmployee[l.employee.id] ?? 0) + 1;
    }

    const rows = employees.map((e) => {
      const rec = todayAttendance.find((a) => (a as any).employeeId === e.id || a.employee?.id === e.id);
      return {
        id: e.id,
        employeeId: e.employeeId,
        name: this.fullName(e),
        designation: e.designation ?? null,
        department: e.department ?? null,
        email: (e as any).user?.email ?? e.personalEmail ?? null,
        phone: e.phone ?? null,
        avatarUrl: e.avatarUrl ?? null,
        status: e.status,
        presence: this.presenceOf(e.id, todayAttendance, onLeaveToday),
        checkIn: rec?.checkIn ? new Date(rec.checkIn).toISOString() : null,
        pendingRequests: pendingByEmployee[e.id] ?? 0,
      };
    });

    const result = { generatedAt: new Date().toISOString(), total: rows.length, employees: rows };
    await this.cache.set(DIRECTORY_KEY, result, 30_000);
    return result;
  }
}
