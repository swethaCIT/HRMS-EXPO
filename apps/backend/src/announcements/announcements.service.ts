import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from './entities/announcement.entity';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
  ) {}

  findAll(): Promise<Announcement[]> {
    return this.announcementRepo.find({ order: { pinned: 'DESC', createdAt: 'DESC' } });
  }

  create(data: Partial<Announcement>): Promise<Announcement> {
    return this.announcementRepo.save(this.announcementRepo.create(data));
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const announcement = await this.announcementRepo.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    await this.announcementRepo.remove(announcement);
    return { id, deleted: true };
  }
}
