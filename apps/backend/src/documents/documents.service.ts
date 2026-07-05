import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly storageService: StorageService,
  ) {}

  findByEmployee(employeeId: string): Promise<Document[]> {
    return this.documentRepo.find({ where: { employeeId }, order: { createdAt: 'DESC' } });
  }

  create(data: Partial<Document>): Promise<Document> {
    return this.documentRepo.save(this.documentRepo.create(data));
  }

  async upload(file: any, employeeId: string, category: string, uploadedById: string): Promise<Document> {
    const url = await this.storageService.uploadFile(
      `documents/${employeeId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    return this.documentRepo.save(
      this.documentRepo.create({
        employeeId,
        name: file.originalname,
        category: category || 'other',
        url,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById,
      }),
    );
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const document = await this.documentRepo.findOne({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');
    await this.documentRepo.remove(document);
    return { id, deleted: true };
  }
}
