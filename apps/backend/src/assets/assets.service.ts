import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './entities/asset.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
  ) {}

  findAll(): Promise<Asset[]> {
    return this.assetRepo.find({ order: { createdAt: 'DESC' } });
  }

  findByEmployee(employeeId: string): Promise<Asset[]> {
    return this.assetRepo.find({ where: { employeeId }, order: { createdAt: 'DESC' } });
  }

  create(data: Partial<Asset>): Promise<Asset> {
    return this.assetRepo.save(this.assetRepo.create(data));
  }

  async returnAsset(id: string): Promise<Asset | null> {
    await this.assetRepo.update(id, { status: 'returned' });
    return this.assetRepo.findOne({ where: { id } });
  }
}
