import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { clampPaging } from '../common/utils/pagination';

interface PunchOpts {
  mode?: 'office' | 'wfh';
  source?: string; // manual | biometric | geo | system
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
  ) {}

  /**
   * Today's calendar date in the SERVER's local zone — deliberately not
   * `toISOString()`, which yields the UTC date. Writes go through TypeORM's
   * `date` column conversion, which uses the local calendar date, so reading
   * back with a UTC date desynchronises for any non-UTC server: at UTC+5:30,
   * a punch between 00:00 and 05:30 local writes tomorrow's date but is looked
   * up under yesterday's, so the record is never found — the UI shows "not
   * checked in", every retry inserts another row, and check-out fails with
   * "No check-in record found for today".
   */
  private todayStr() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Today's record for an employee (or null). */
  getToday(employeeId: string): Promise<Attendance | null> {
    return this.attendanceRepo.findOne({
      where: { employee: { id: employeeId }, date: this.todayStr() as any },
    });
  }

  /** Idempotent check-in — returns today's record if already punched in. */
  async checkIn(employeeId: string, opts: PunchOpts = {}): Promise<Attendance> {
    const existing = await this.getToday(employeeId);
    if (existing) return existing;

    const now = new Date();
    // Late if punched in after 09:30 local time.
    const late = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
    const status =
      opts.mode === 'wfh'
        ? AttendanceStatus.WORK_FROM_HOME
        : late
          ? AttendanceStatus.LATE
          : AttendanceStatus.PRESENT;

    const record = this.attendanceRepo.create({
      employee: { id: employeeId } as any,
      date: now,
      checkIn: now,
      status,
      source: opts.source || 'manual',
    });
    return this.attendanceRepo.save(record);
  }

  async checkOut(employeeId: string): Promise<Attendance> {
    const record = await this.getToday(employeeId);
    if (!record) throw new NotFoundException('No check-in record found for today');
    record.checkOut = new Date();
    return this.attendanceRepo.save(record);
  }

  /**
   * Newest first and always bounded. An employee accrues ~250 rows a year, so
   * an unbounded read here grows without limit; callers page with limit/offset.
   */
  async findByEmployee(employeeId: string, limit?: number, offset?: number): Promise<Attendance[]> {
    const { take, skip } = clampPaging(limit, offset);
    return this.attendanceRepo.find({
      where: { employee: { id: employeeId } },
      order: { date: 'DESC' },
      take,
      skip,
    });
  }

  /**
   * Org-wide attendance, bounded. At 1,000 employees this table gains ~250k
   * rows a year; reading it whole materialised every row as an entity and
   * serialised hundreds of MB, pinning a pool connection until the 15s
   * statement timeout killed it.
   */
  async findAll(limit?: number, offset?: number): Promise<Attendance[]> {
    const { take, skip } = clampPaging(limit, offset);
    return this.attendanceRepo.find({
      relations: { employee: true },
      order: { date: 'DESC' },
      take,
      skip,
    });
  }
}
