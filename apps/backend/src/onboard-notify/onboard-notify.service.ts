import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { OnboardingRecord, OnboardEmployeeType, OnboardStatus } from './entities/onboarding-record.entity';
import { OnboardingFormResponse } from './entities/onboarding-form-response.entity';
import { OnboardingReview, OnboardReviewDecision } from './entities/onboarding-review.entity';
import { OnboardingForward, OnboardForwardStatus } from './entities/onboarding-forward.entity';
import { CreateOnboardingRecordDto } from './dto/create-onboarding-record.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';
import { ForwardDecisionDto } from './dto/forward-decision.dto';
import { OnboardingAuthService } from './onboarding-auth.service';
import { computeCompletion, isValidSectionKey } from './onboarding-sections';
import { ONBOARD_FIELD_CATALOG, DEFAULT_DEPARTMENT_FIELDS, renderFieldsForNotification } from './onboarding-field-catalog';
import { clampPaging } from '../common/utils/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTemplatesService } from '../notifications/notification-templates.service';
import { NotificationType, NotificationStatus } from '../notifications/entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { EmployeesService } from '../employees/employees.service';
import { AuditService, AuditActor } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

const REVIEWABLE_STATUSES = [OnboardStatus.SUBMITTED, OnboardStatus.HR_REVIEW];
const RESENDABLE_STATUSES = [OnboardStatus.INVITATION_SENT, OnboardStatus.LINK_OPENED];

export interface OnboardListFilters {
  employeeType?: OnboardEmployeeType;
  status?: OnboardStatus;
  department?: string;
  joiningDateFrom?: string;
  joiningDateTo?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class OnboardNotifyService {
  private readonly logger = new Logger(OnboardNotifyService.name);

  constructor(
    @InjectRepository(OnboardingRecord) private readonly recordRepo: Repository<OnboardingRecord>,
    @InjectRepository(OnboardingFormResponse) private readonly responseRepo: Repository<OnboardingFormResponse>,
    @InjectRepository(OnboardingReview) private readonly reviewRepo: Repository<OnboardingReview>,
    @InjectRepository(OnboardingForward) private readonly forwardRepo: Repository<OnboardingForward>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auth: OnboardingAuthService,
    private readonly templates: NotificationTemplatesService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly users: UsersService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private companyName(): string {
    return this.config.get<string>('COMPANY_NAME') || 'HRMS';
  }

  /** Static — carries no secret. Identity comes entirely from the login-ID/password the candidate types in, not from anything in this URL. */
  private portalLink(): string {
    const base = (this.config.get<string>('PUBLIC_BASE_URL') || `http://localhost:${this.config.get('PORT') || 3000}`).replace(/\/+$/, '');
    return `${base}/api/v1/onboard-notify/portal`;
  }

  private inviteTemplateKey(type: OnboardEmployeeType): string {
    return type === OnboardEmployeeType.FRESHER ? 'onboarding.invite.fresher' : 'onboarding.invite.experienced';
  }

  private async sendInviteEmail(record: OnboardingRecord, tempPassword: string): Promise<void> {
    const key = this.inviteTemplateKey(record.employeeType);
    const { subject, body } = await this.templates.render(key, {
      company: this.companyName(),
      name: record.tempName,
      loginId: record.loginId,
      tempPassword,
      link: this.portalLink(),
    });
    await this.mail.send(record.email, subject, body);
  }

  /**
   * Fires an email without making the caller's HTTP response wait on it.
   * `MailService.send()` already never throws (it catches its own errors and
   * returns `{delivered: false}`), so the only thing blocking here was SMTP
   * round-trip latency — on some networks (e.g. Gmail from a fresh cloud IP)
   * that alone was enough to trip the global 20s request timeout even though
   * the record had already saved successfully. The record's existence never
   * depends on the email actually sending.
   */
  private fireInviteEmail(record: OnboardingRecord, tempPassword: string): void {
    void this.sendInviteEmail(record, tempPassword).catch((err) =>
      this.logger.error(`Failed to send onboarding invite to ${record.email}: ${err?.message}`),
    );
  }

  async create(dto: CreateOnboardingRecordDto, actor: AuditActor): Promise<OnboardingRecord> {
    const onboardingRef = `OBN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const tempPassword = this.auth.generateTempPassword();
    const passwordHash = await this.auth.hashPassword(tempPassword);

    const record = await this.recordRepo.save(
      this.recordRepo.create({
        onboardingRef,
        loginId: onboardingRef,
        passwordHash,
        mustChangePassword: true,
        tempName: dto.tempName,
        mobile: dto.mobile,
        email: dto.email,
        employeeType: dto.employeeType,
        expectedJoiningDate: dto.expectedJoiningDate ? new Date(dto.expectedJoiningDate) : null,
        department: dto.department,
        designation: dto.designation,
        reportingManagerId: dto.reportingManagerId,
        status: OnboardStatus.INVITATION_SENT,
        createdById: actor.id!,
      }),
    );

    this.fireInviteEmail(record, tempPassword);

    void this.audit.record({
      action: AuditAction.CREATED,
      entityType: 'onboarding_record',
      entityId: record.id,
      entityLabel: record.onboardingRef,
      actor,
      subjectName: record.tempName,
      summary: `${actor.name ?? 'HR'} started ${record.employeeType} onboarding for ${record.tempName} (${record.onboardingRef})`,
    });

    return record;
  }

  async findAll(filters: OnboardListFilters) {
    const { take, skip } = clampPaging(filters.limit, filters.offset);
    const where: Record<string, any> = {};
    if (filters.employeeType) where.employeeType = filters.employeeType;
    if (filters.status) where.status = filters.status;
    if (filters.department) where.department = filters.department;
    if (filters.joiningDateFrom && filters.joiningDateTo) {
      where.expectedJoiningDate = Between(new Date(filters.joiningDateFrom), new Date(filters.joiningDateTo));
    }

    const [items, total] = await this.recordRepo.findAndCount({ where, order: { createdAt: 'DESC' }, take, skip });

    // Batch-fetch responses for exactly this page rather than one query per
    // row, so the list screen's completion % doesn't cost N+1 round trips.
    const responses = items.length
      ? await this.responseRepo.find({ where: { onboardingId: In(items.map((i) => i.id)) } })
      : [];
    const responseByOnboardingId = new Map(responses.map((r) => [r.onboardingId, r]));

    const withProgress = items.map((record) => ({
      ...record,
      completionPercent: computeCompletion(record.employeeType, responseByOnboardingId.get(record.id) ?? null).percent,
    }));

    return { items: withProgress, total, limit: take, offset: skip };
  }

  private async loadRecord(id: string): Promise<OnboardingRecord> {
    const record = await this.recordRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Onboarding record not found');
    return record;
  }

  /** Full detail for the HR review screen. Opening a SUBMITTED record marks it under active review. */
  async findOne(id: string) {
    const record = await this.loadRecord(id);
    if (record.status === OnboardStatus.SUBMITTED) {
      record.status = OnboardStatus.HR_REVIEW;
      await this.recordRepo.update(id, { status: OnboardStatus.HR_REVIEW });
    }
    const [response, reviews, forwards] = await Promise.all([
      this.responseRepo.findOne({ where: { onboardingId: id } }),
      this.reviewRepo.find({ where: { onboardingId: id }, order: { reviewedAt: 'DESC' } }),
      this.forwardRepo.find({ where: { onboardingId: id }, order: { createdAt: 'DESC' } }),
    ]);
    const { percent, sections } = computeCompletion(record.employeeType, response);
    return { record, response, reviews, forwards, completionPercent: percent, sectionsDone: sections };
  }

  /** A fresh temporary password for the SAME login ID/record — never a second account. */
  async resend(id: string, actor: AuditActor): Promise<OnboardingRecord> {
    const record = await this.loadRecord(id);
    if (!RESENDABLE_STATUSES.includes(record.status)) {
      throw new BadRequestException(`Cannot resend the invite once onboarding has status "${record.status}"`);
    }
    const tempPassword = await this.auth.resetTempPassword(record);
    this.fireInviteEmail(record, tempPassword);
    void this.audit.record({
      action: AuditAction.UPDATED,
      entityType: 'onboarding_record',
      entityId: record.id,
      entityLabel: record.onboardingRef,
      actor,
      subjectName: record.tempName,
      summary: `${actor.name ?? 'HR'} resent the onboarding invite to ${record.tempName} with a new temporary password`,
    });
    return record;
  }

  async review(id: string, dto: ReviewDecisionDto, actor: AuditActor) {
    const record = await this.loadRecord(id);
    if (!REVIEWABLE_STATUSES.includes(record.status)) {
      throw new BadRequestException(`Cannot review onboarding with status "${record.status}"`);
    }

    if (dto.correctionSections?.length) {
      for (const c of dto.correctionSections) {
        if (!isValidSectionKey(record.employeeType, c.section)) {
          throw new BadRequestException(`"${c.section}" is not a valid section for a ${record.employeeType} onboarding.`);
        }
      }
    }

    await this.reviewRepo.save(
      this.reviewRepo.create({
        onboardingId: id,
        reviewedById: actor.id!,
        decision: dto.decision,
        comments: dto.comments ?? null,
        correctionSections: dto.correctionSections?.length ? dto.correctionSections : null,
      }),
    );

    if (dto.decision === OnboardReviewDecision.APPROVED) {
      record.status = OnboardStatus.APPROVED;
      await this.recordRepo.update(id, { status: record.status });
      void this.audit.record({
        action: AuditAction.APPROVED,
        entityType: 'onboarding_record',
        entityId: id,
        entityLabel: record.onboardingRef,
        actor,
        subjectName: record.tempName,
        summary: `${actor.name ?? 'HR'} approved ${record.tempName}'s onboarding submission`,
      });
    } else {
      record.status = OnboardStatus.CHANGES_REQUESTED;
      await this.recordRepo.update(id, { status: record.status });

      // No new credentials, no new link — the candidate signs back in with
      // the password they already set.
      const sectionList = dto.correctionSections?.length
        ? dto.correctionSections.map((c) => `- ${c.section}: ${c.reason}`).join('\n')
        : '';
      const { subject, body } = await this.templates.render('onboarding.changes_requested', {
        name: record.tempName,
        link: this.portalLink(),
        loginId: record.loginId,
        comments: [dto.comments ?? '', sectionList].filter(Boolean).join('\n\n'),
      });
      void this.mail.send(record.email, subject, body).catch((err) =>
        this.logger.error(`Failed to send change-request email to ${record.email}: ${err?.message}`),
      );

      void this.audit.record({
        action: AuditAction.REJECTED,
        entityType: 'onboarding_record',
        entityId: id,
        entityLabel: record.onboardingRef,
        actor,
        subjectName: record.tempName,
        summary: `${actor.name ?? 'HR'} requested changes to ${record.tempName}'s onboarding submission`,
      });
    }

    return this.findOne(id);
  }

  fieldCatalog() {
    return {
      fields: Object.entries(ONBOARD_FIELD_CATALOG).map(([key, { label }]) => ({ key, label })),
      defaultsByDepartment: DEFAULT_DEPARTMENT_FIELDS,
    };
  }

  async forward(id: string, dto: ForwardDecisionDto, actor: AuditActor) {
    const record = await this.loadRecord(id);
    if (record.status !== OnboardStatus.APPROVED) {
      throw new BadRequestException(`Cannot forward onboarding with status "${record.status}" — it must be Approved first`);
    }

    // Validate every recipient BEFORE persisting anything — a bad id must
    // abort the whole batch, not partially forward.
    for (const entry of dto.forwards) {
      await this.users.findOne(entry.recipientUserId);
    }

    // All-or-nothing: the forward rows and the record's status transition
    // commit together, so a mid-batch failure can never leave the record
    // Approved with only some of the forwards recorded.
    const savedForwards = await this.dataSource.transaction(async (manager) => {
      const forwardRepo = manager.getRepository(OnboardingForward);
      const recordRepo = manager.getRepository(OnboardingRecord);
      const rows = await forwardRepo.save(
        dto.forwards.map((entry) =>
          forwardRepo.create({
            onboardingId: id,
            department: entry.department,
            recipientUserId: entry.recipientUserId,
            fieldsShared: entry.fieldsShared,
          }),
        ),
      );
      await recordRepo.update(id, { status: OnboardStatus.FORWARDED });
      return rows;
    });

    void this.audit.record({
      action: AuditAction.ASSIGNED,
      entityType: 'onboarding_record',
      entityId: id,
      entityLabel: record.onboardingRef,
      actor,
      subjectName: record.tempName,
      summary: `${actor.name ?? 'HR'} forwarded ${record.tempName}'s onboarding info to ${dto.forwards.map((f) => f.department).join(', ')}`,
    });

    // Delivery is best-effort and happens after the transaction commits —
    // network calls don't belong inside a DB transaction, and each row
    // already has its own PENDING/SENT/FAILED tracking picked up by
    // NotificationsService's existing retry cron on failure.
    const response = await this.responseRepo.findOne({ where: { onboardingId: id } });
    let reportingManagerName: string | undefined;
    if (record.reportingManagerId) {
      const mgr = await this.employees.findOne(record.reportingManagerId).catch(() => null);
      reportingManagerName = mgr ? `${mgr.firstName} ${mgr.lastName}` : undefined;
    }

    for (const row of savedForwards) {
      const fieldText = renderFieldsForNotification(row.fieldsShared, { record, response, reportingManagerName });
      const body = fieldText || `${record.tempName}'s onboarding information has been shared with your team.`;
      const notification = await this.notifications.createPendingForUser(
        row.recipientUserId,
        `Onboarding info: ${record.tempName}`,
        body,
        NotificationType.ONBOARD_ROUTED,
      );
      await this.forwardRepo.update(row.id, { notificationId: notification.id });

      // Fire-and-forget: on a slow mail network N forwards x up to ~20s each
      // could blow the request past the global timeout despite every DB
      // write already having succeeded. The forward rows start PENDING and
      // update to SENT/FAILED once dispatch resolves — the HR review screen
      // already polls, and NotificationsService's own retry cron covers a
      // FAILED outcome, so nothing here needs the caller to wait on it.
      void this.notifications
        .dispatch(notification)
        .then(() =>
          this.forwardRepo.update(row.id, {
            status: notification.status === NotificationStatus.SENT ? OnboardForwardStatus.SENT : OnboardForwardStatus.FAILED,
            sentAt: notification.sentAt ?? undefined,
          }),
        )
        .catch((err) => this.logger.error(`Failed to dispatch forward notification for ${record.onboardingRef}: ${err?.message}`));
    }

    return this.findOne(id);
  }

  async complete(id: string, actor: AuditActor) {
    const record = await this.loadRecord(id);
    if (record.status !== OnboardStatus.FORWARDED) {
      throw new BadRequestException(`Cannot complete onboarding with status "${record.status}" — it must be Forwarded first`);
    }
    await this.recordRepo.update(id, { status: OnboardStatus.COMPLETED });
    void this.audit.record({
      action: AuditAction.UPDATED,
      entityType: 'onboarding_record',
      entityId: id,
      entityLabel: record.onboardingRef,
      actor,
      subjectName: record.tempName,
      summary: `${actor.name ?? 'HR'} marked ${record.tempName}'s onboarding as completed`,
    });
    return this.findOne(id);
  }
}
