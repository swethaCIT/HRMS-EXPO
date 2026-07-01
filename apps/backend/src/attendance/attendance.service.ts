import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

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

  private todayStr() {
    return new Date().toISOString().split('T')[0];
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

  async findByEmployee(employeeId: string): Promise<Attendance[]> {
    return this.attendanceRepo.find({
      where: { employee: { id: employeeId } },
      order: { date: 'DESC' },
    });
  }

  async findAll(): Promise<Attendance[]> {
    return this.attendanceRepo.find({ relations: { employee: true } });
  }
}
