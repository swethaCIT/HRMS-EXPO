import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from './entities/attendance.entity';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
  ) {}

  async checkIn(employeeId: string): Promise<Attendance> {
    const record = this.attendanceRepo.create({
      employee: { id: employeeId } as any,
      date: new Date(),
      checkIn: new Date(),
    });
    return this.attendanceRepo.save(record);
  }

  async checkOut(employeeId: string): Promise<Attendance> {
    const today = new Date().toISOString().split('T')[0];
    const record = await this.attendanceRepo.findOne({
      where: { employee: { id: employeeId }, date: today as any },
    });
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
