import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum OnboardReviewDecision {
  APPROVED = 'approved',
  CHANGES_REQUESTED = 'changes_requested',
}

/** One row per HR review action — an append-only history, not upserted, so every review cycle (including repeat change-request rounds) stays visible. */
@Entity('onboarding_reviews')
export class OnboardingReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  onboardingId: string;

  @Column()
  reviewedById: string;

  @Column({ type: 'enum', enum: OnboardReviewDecision })
  decision: OnboardReviewDecision;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  /**
   * Which section(s) need fixing and why, e.g.
   * [{ section: 'employmentHistory', reason: 'Please correct your previous CTC.' }].
   * Only meaningful when decision is CHANGES_REQUESTED. When empty/omitted on
   * a changes-requested review, the portal falls back to treating every
   * section as editable (see onboarding-sections.ts#editableSectionKeys).
   */
  @Column({ type: 'jsonb', nullable: true })
  correctionSections: { section: string; reason: string }[] | null;

  @CreateDateColumn()
  reviewedAt: Date;
}
