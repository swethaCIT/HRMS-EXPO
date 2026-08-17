import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { OnboardingRecord, OnboardStatus } from './entities/onboarding-record.entity';
import { OnboardingFormResponse, OnboardDocumentMeta } from './entities/onboarding-form-response.entity';
import { OnboardingReview } from './entities/onboarding-review.entity';
import { computeCompletion, editableSectionKeys, isValidSectionKey, sectionsFor, SECTION_LABELS } from './onboarding-sections';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

export const ONBOARD_DOCUMENT_CATEGORIES = [
  'photo',
  'identity_proof',
  'pan',
  'education_certificate',
  'bank_proof',
  'experience_certificate',
  'relieving_letter',
  'payslip',
  'employment_proof',
  'other',
] as const;

/** Strips internal storage keys before anything leaves the portal API. */
function sanitizeDocuments(docs: OnboardDocumentMeta[]): Omit<OnboardDocumentMeta, 'storagePath'>[] {
  return docs.map(({ storagePath: _storagePath, ...rest }) => rest);
}

@Injectable()
export class OnboardNotifyPortalService {
  constructor(
    @InjectRepository(OnboardingRecord) private readonly recordRepo: Repository<OnboardingRecord>,
    @InjectRepository(OnboardingFormResponse) private readonly responseRepo: Repository<OnboardingFormResponse>,
    @InjectRepository(OnboardingReview) private readonly reviewRepo: Repository<OnboardingReview>,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private async ensureResponse(onboardingId: string): Promise<OnboardingFormResponse> {
    let response = await this.responseRepo.findOne({ where: { onboardingId } });
    if (!response) {
      response = await this.responseRepo.save(this.responseRepo.create({ onboardingId, documents: [] }));
    }
    return response;
  }

  private async latestReview(onboardingId: string): Promise<OnboardingReview | null> {
    return this.reviewRepo.findOne({ where: { onboardingId }, order: { reviewedAt: 'DESC' } });
  }

  /**
   * The employee dashboard: identity, completion, per-section done/not-done,
   * which sections are currently writable, and the latest correction request
   * if any. Advances LINK_OPENED/FORM_IN_PROGRESS as a side effect of the
   * candidate actually loading it — mirrors the old link-based flow's status
   * ratchet, just triggered by a session request instead of a token GET.
   */
  async dashboard(record: OnboardingRecord) {
    let status = record.status;
    if (status === OnboardStatus.INVITATION_SENT) status = OnboardStatus.LINK_OPENED;
    else if (status === OnboardStatus.LINK_OPENED) status = OnboardStatus.FORM_IN_PROGRESS;
    if (status !== record.status) await this.recordRepo.update(record.id, { status });

    const [response, review] = await Promise.all([
      this.responseRepo.findOne({ where: { onboardingId: record.id } }),
      this.latestReview(record.id),
    ]);
    const { percent, sections } = computeCompletion(record.employeeType, response);
    const editable = editableSectionKeys(record.employeeType, status, review);

    return {
      record: {
        onboardingRef: record.onboardingRef,
        tempName: record.tempName,
        employeeType: record.employeeType,
        expectedJoiningDate: record.expectedJoiningDate,
        department: record.department,
        designation: record.designation,
      },
      status,
      sectionOrder: sectionsFor(record.employeeType).map((key) => ({ key, label: SECTION_LABELS[key] })),
      completionPercent: percent,
      sectionsDone: sections,
      editableSections: editable,
      response: response
        ? {
            personalDetails: response.personalDetails,
            contactInfo: response.contactInfo,
            emergencyContact: response.emergencyContact,
            education: response.education,
            bankDetails: response.bankDetails,
            employmentHistory: response.employmentHistory,
            documents: sanitizeDocuments(response.documents ?? []),
          }
        : null,
      correction:
        status === OnboardStatus.CHANGES_REQUESTED && review
          ? { comments: review.comments, sections: review.correctionSections ?? [] }
          : null,
    };
  }

  async saveSection(record: OnboardingRecord, key: string, data: Record<string, any>) {
    if (!isValidSectionKey(record.employeeType, key)) {
      throw new BadRequestException(`"${key}" is not a valid section for a ${record.employeeType} onboarding.`);
    }
    const review = await this.latestReview(record.id);
    const editable = editableSectionKeys(record.employeeType, record.status, review);
    if (!editable.includes(key as any)) {
      throw new BadRequestException(`The "${SECTION_LABELS[key as keyof typeof SECTION_LABELS]}" section is not currently editable.`);
    }
    if (key === 'documents') {
      throw new BadRequestException('Use the document upload endpoint to add documents, not this one.');
    }

    const response = await this.ensureResponse(record.id);
    await this.responseRepo.update(response.id, { [key]: data });

    if (record.status === OnboardStatus.INVITATION_SENT || record.status === OnboardStatus.LINK_OPENED) {
      await this.recordRepo.update(record.id, { status: OnboardStatus.FORM_IN_PROGRESS });
    }

    return this.dashboard(await this.recordRepo.findOneOrFail({ where: { id: record.id } }));
  }

  async submit(record: OnboardingRecord) {
    const editable = editableSectionKeys(record.employeeType, record.status, await this.latestReview(record.id));
    if (!editable.length) {
      throw new BadRequestException('This onboarding form has already been submitted and cannot be submitted again.');
    }
    const response = await this.responseRepo.findOne({ where: { onboardingId: record.id } });
    const { percent } = computeCompletion(record.employeeType, response);
    if (percent < 100) {
      throw new BadRequestException('Please complete every section before submitting.');
    }

    await this.responseRepo.update(response!.id, { submittedAt: new Date() });
    await this.recordRepo.update(record.id, { status: OnboardStatus.SUBMITTED });

    void this.audit.record({
      action: AuditAction.UPDATED,
      entityType: 'onboarding_record',
      entityId: record.id,
      entityLabel: record.onboardingRef,
      subjectName: record.tempName,
      summary: `${record.tempName} submitted their onboarding form (${record.onboardingRef})`,
    });

    const notification = await this.notifications.createPendingForUser(
      record.createdById,
      `Onboarding submitted: ${record.tempName}`,
      `${record.tempName} has submitted their onboarding form (${record.onboardingRef}). Review it in Onboard Notify.`,
      NotificationType.ONBOARD_SUBMITTED,
    );
    await this.notifications.dispatch(notification);

    return this.dashboard(await this.recordRepo.findOneOrFail({ where: { id: record.id } }));
  }

  async uploadDocument(
    record: OnboardingRecord,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    category: string,
  ) {
    const editable = editableSectionKeys(record.employeeType, record.status, await this.latestReview(record.id));
    if (!editable.includes('documents')) {
      throw new BadRequestException('Documents are not currently editable.');
    }
    if (!ONBOARD_DOCUMENT_CATEGORIES.includes(category as any)) {
      throw new BadRequestException(`Unknown document category "${category}"`);
    }

    const storagePath = await this.storage.uploadFile(
      `onboarding/${record.id}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );

    const response = await this.ensureResponse(record.id);
    const documents = [
      ...(response.documents ?? []),
      {
        id: randomUUID(),
        storagePath,
        name: file.originalname,
        category,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      },
    ];
    await this.responseRepo.update(response.id, { documents });

    return sanitizeDocuments(documents);
  }

  /** "Remove"/the first half of "Replace" — the dropzone for that slot simply reappears once removed. */
  async removeDocument(record: OnboardingRecord, documentId: string) {
    const editable = editableSectionKeys(record.employeeType, record.status, await this.latestReview(record.id));
    if (!editable.includes('documents')) {
      throw new BadRequestException('Documents are not currently editable.');
    }

    const response = await this.ensureResponse(record.id);
    const target = (response.documents ?? []).find((d) => d.id === documentId);
    if (!target) throw new NotFoundException('Document not found');

    await this.storage.deleteFile(target.storagePath).catch(() => {});
    const documents = (response.documents ?? []).filter((d) => d.id !== documentId);
    await this.responseRepo.update(response.id, { documents });

    return sanitizeDocuments(documents);
  }
}
