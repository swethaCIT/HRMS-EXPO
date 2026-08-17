import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** Metadata/reference only — actual bytes live in Supabase Storage via StorageService, never here. Mirrors documents/entities/document.entity.ts. */
export interface OnboardDocumentMeta {
  /** Client-safe identifier for remove/replace — `storagePath` itself is never sent to the portal (see sanitizeDocuments). */
  id: string;
  storagePath: string;
  name: string;
  category: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

/**
 * One row per onboarding record, upserted in place on every submit — the
 * change-request round-trip re-shows and edits the SAME row, it never inserts
 * a new one. See OnboardNotifyPublicService.submit().
 */
@Entity('onboarding_form_responses')
export class OnboardingFormResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  onboardingId: string;

  @Column({ type: 'jsonb', nullable: true })
  personalDetails: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  contactInfo: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  emergencyContact: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  education: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  bankDetails: Record<string, any> | null;

  /** Null for freshers — only present for OnboardEmployeeType.EXPERIENCED. */
  @Column({ type: 'jsonb', nullable: true })
  employmentHistory: Record<string, any> | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  documents: OnboardDocumentMeta[];

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
