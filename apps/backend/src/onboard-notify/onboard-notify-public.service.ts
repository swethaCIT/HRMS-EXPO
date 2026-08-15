import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnboardingRecord, OnboardStatus } from './entities/onboarding-record.entity';
import { OnboardingFormResponse, OnboardDocumentMeta } from './entities/onboarding-form-response.entity';
import { PublicSubmitFormDto } from './dto/public-submit-form.dto';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

/** Statuses in which the candidate may still view/edit the form via their link. Everything else is read-only (already submitted and awaiting/past review). */
const EDITABLE_STATUSES = [
  OnboardStatus.INVITATION_SENT,
  OnboardStatus.LINK_OPENED,
  OnboardStatus.FORM_IN_PROGRESS,
  OnboardStatus.CHANGES_REQUESTED,
];

export const ONBOARD_DOCUMENT_CATEGORIES = [
  'photo',
  'aadhaar',
  'pan',
  'education_certificate',
  'experience_certificate',
  'relieving_letter',
  'payslip',
  'employment_proof',
  'other',
] as const;

/** Strips internal storage keys before anything leaves the public API. */
function sanitizeDocuments(docs: OnboardDocumentMeta[]): Omit<OnboardDocumentMeta, 'storagePath'>[] {
  return docs.map(({ storagePath: _storagePath, ...rest }) => rest);
}

@Injectable()
export class OnboardNotifyPublicService {
  constructor(
    @InjectRepository(OnboardingRecord) private readonly recordRepo: Repository<OnboardingRecord>,
    @InjectRepository(OnboardingFormResponse) private readonly responseRepo: Repository<OnboardingFormResponse>,
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

  /** GET data for the public form. Advances the record through LINK_OPENED/FORM_IN_PROGRESS as a side effect of the candidate actually loading it. */
  async getData(record: OnboardingRecord) {
    let status = record.status;
    if (status === OnboardStatus.INVITATION_SENT) status = OnboardStatus.LINK_OPENED;
    else if (status === OnboardStatus.LINK_OPENED) status = OnboardStatus.FORM_IN_PROGRESS;
    if (status !== record.status) {
      await this.recordRepo.update(record.id, { status });
    }

    const response = await this.responseRepo.findOne({ where: { onboardingId: record.id } });

    return {
      record: {
        onboardingRef: record.onboardingRef,
        tempName: record.tempName,
        employeeType: record.employeeType,
        expectedJoiningDate: record.expectedJoiningDate,
        department: record.department,
        designation: record.designation,
      },
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
      status,
      editable: EDITABLE_STATUSES.includes(status),
    };
  }

  private assertEditable(record: OnboardingRecord): void {
    if (!EDITABLE_STATUSES.includes(record.status)) {
      throw new BadRequestException('This onboarding form has already been submitted and can no longer be edited.');
    }
  }

  async submit(record: OnboardingRecord, dto: PublicSubmitFormDto) {
    this.assertEditable(record);

    const response = await this.ensureResponse(record.id);
    await this.responseRepo.update(response.id, {
      personalDetails: dto.personalDetails,
      contactInfo: dto.contactInfo,
      emergencyContact: dto.emergencyContact,
      education: dto.education,
      bankDetails: dto.bankDetails,
      // Never persisted for freshers, regardless of what the client sends.
      employmentHistory: record.employeeType === 'experienced' ? (dto.employmentHistory ?? null) : null,
      submittedAt: new Date(),
    });

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

    return this.getData(await this.recordRepo.findOneOrFail({ where: { id: record.id } }));
  }

  async uploadDocument(
    record: OnboardingRecord,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    category: string,
  ) {
    this.assertEditable(record);
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
}
