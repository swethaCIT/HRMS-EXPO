import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Employee } from '../employees/entities/employee.entity';
import { Leave, LeaveStatus } from '../leaves/entities/leave.entity';
import { Attendance } from '../attendance/entities/attendance.entity';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CACHE_KEY = 'analytics:summary';
const CACHE_TTL = 60_000; // 60s — the dashboard tolerates minute-old numbers.

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

  /**
   * Cached summary. This endpoint is opened by every manager/HR user, so under
   * load it must not re-scan tables each time. Results are cached for 60s and the
   * heavy tables are bounded: attendance is queried for the last 7 days only
   * (it grows one row per employee per day — unbounded otherwise) and leaves are
   * limited to the current year.
   */
  async summary() {
    const cached = await this.cache.get(CACHE_KEY);
    if (cached) return cached;

    const year = new Date().getFullYear();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sinceDate = sevenDaysAgo.toISOString().slice(0, 10);
    const yearStart = `${year}-01-01`;

    const [employees, leaves, attendance] = await Promise.all([
      this.empRepo.find(),
      this.leaveRepo.find({ where: { startDate: MoreThanOrEqual(yearStart) as any } }),
      this.attRepo.find({ where: { date: MoreThanOrEqual(sinceDate) as any } }),
    ]);
    const headcount = employees.length;

    // Leave distribution (approved, this year) by type
    const leaveMap: Record<string, number> = {};
    for (const l of leaves) {
      if (this.dateKey(l.startDate).slice(0, 4) === String(year) && l.status === LeaveStatus.APPROVED) {
        leaveMap[l.type] = (leaveMap[l.type] || 0) + (Number(l.totalDays) || 0);
      }
    }
    const leaveDistribution = Object.entries(leaveMap).map(([type, value]) => ({ label: cap(type), value }));

    // Attendance trend — last 7 days, % of headcount that had a record
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

    const result = {
      headcount,
      departments: new Set(employees.map((e) => e.department || 'General')).size,
      headcountByDept: this.groupCount(employees, (e) => e.department || 'General'),
      genderSplit: this.groupCount(employees, (e: any) => e.gender || 'Not disclosed'),
      leaveDistribution,
      attendanceTrend,
      attendanceLabels,
      avgAttendance,
      leaveDaysApproved: Object.values(leaveMap).reduce((a, b) => a + b, 0),
    };

    await this.cache.set(CACHE_KEY, result, CACHE_TTL);
    return result;
  }
}
