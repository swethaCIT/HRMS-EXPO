import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { StorageService } from '../storage/storage.service';

/** A document plus a short-lived link, which is never persisted. */
export type DocumentWithLink = Document & { downloadUrl: string | null; expiresInSeconds?: number };

@Injectable()
export class DocumentsService {
  /** Long enough to open or download a file, short enough that a leaked link dies quickly. */
  private static readonly LINK_TTL_SECONDS = 300;

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly storageService: StorageService,
  ) {}

  /**
   * List an employee's documents, each with a freshly signed, expiring link.
   * Links are generated per request rather than stored, so access always
   * requires having just passed the ownership check on the way in.
   */
  async findByEmployee(employeeId: string): Promise<DocumentWithLink[]> {
    const docs = await this.documentRepo.find({ where: { employeeId }, order: { createdAt: 'DESC' } });
    if (!docs.length) return [];

    const signed = await this.storageService.getSignedUrls(
      docs.map((d) => d.storagePath).filter((p): p is string => !!p),
      DocumentsService.LINK_TTL_SECONDS,
    );

    return docs.map((d) => ({
      ...d,
      // Prefer a signed link; fall back to the legacy stored URL for old rows.
      downloadUrl: (d.storagePath ? signed.get(d.storagePath) : null) ?? d.url ?? null,
      expiresInSeconds: d.storagePath ? DocumentsService.LINK_TTL_SECONDS : undefined,
    }));
  }

  create(data: Partial<Document>): Promise<Document> {
    return this.documentRepo.save(this.documentRepo.create(data));
  }

  async upload(file: any, employeeId: string, category: string, uploadedById: string): Promise<DocumentWithLink> {
    // Prefix with the employee id so the bucket is organised by owner, and
    // timestamp the name so re-uploading the same filename doesn't overwrite.
    const storagePath = await this.storageService.uploadFile(
      `documents/${employeeId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );

    const saved = await this.documentRepo.save(
      this.documentRepo.create({
        employeeId,
        name: file.originalname,
        category: category || 'other',
        storagePath,
        url: null,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById,
      }),
    );

    return {
      ...saved,
      downloadUrl: await this.storageService
        .getSignedUrl(storagePath, DocumentsService.LINK_TTL_SECONDS)
        .catch(() => null),
      expiresInSeconds: DocumentsService.LINK_TTL_SECONDS,
    };
  }

  /** Removes the row AND the stored object, so deleted files don't linger in the bucket. */
  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const document = await this.documentRepo.findOne({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');
    if (document.storagePath) await this.storageService.deleteFile(document.storagePath);
    await this.documentRepo.remove(document);
    return { id, deleted: true };
  }
}
