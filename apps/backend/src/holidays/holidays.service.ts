import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Holiday } from './entities/holiday.entity';

@Injectable()
export class HolidaysService {
  constructor(
    @InjectRepository(Holiday)
    private readonly holidayRepo: Repository<Holiday>,
  ) {}

  findAll(): Promise<Holiday[]> {
    return this.holidayRepo.find({ order: { date: 'ASC' } });
  }

  create(data: Partial<Holiday>): Promise<Holiday> {
    return this.holidayRepo.save(this.holidayRepo.create(data));
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const holiday = await this.holidayRepo.findOne({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    await this.holidayRepo.remove(holiday);
    return { id, deleted: true };
  }
}
