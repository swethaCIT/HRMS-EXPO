import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { Leave, LeaveStatus } from '../leaves/entities/leave.entity';
import { Attendance } from '../attendance/entities/attendance.entity';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Employee) private readonly empRepo: Repository<Employee>,
    @InjectRepository(Leave) private readonly leaveRepo: Repository<Leave>,
    @InjectRepository(Attendance) private readonly attRepo: Repository<Attendance>,
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

  async summary() {
    const [employees, leaves, attendance] = await Promise.all([
      this.empRepo.find(),
      this.leaveRepo.find(),
      this.attRepo.find(),
    ]);
    const headcount = employees.length;
    const year = new Date().getFullYear();

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

    return {
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
  }
}
