import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from './entities/request.entity';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
  ) {}

  findAll(): Promise<Request[]> {
    return this.requestRepo.find({ order: { createdAt: 'DESC' } });
  }

  findMine(userId: string): Promise<Request[]> {
    return this.requestRepo.find({ where: { createdById: userId }, order: { createdAt: 'DESC' } });
  }

  create(data: Partial<Request>, userId: string): Promise<Request> {
    return this.requestRepo.save(this.requestRepo.create({ ...data, createdById: userId, status: 'pending' }));
  }

  private async setStatus(id: string, status: string): Promise<Request> {
    const r = await this.requestRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    r.status = status;
    return this.requestRepo.save(r);
  }

  issue(id: string) { return this.setStatus(id, 'issued'); }
  reject(id: string) { return this.setStatus(id, 'rejected'); }
}
