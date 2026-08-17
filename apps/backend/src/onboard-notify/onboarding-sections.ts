import { OnboardEmployeeType, OnboardStatus } from './entities/onboarding-record.entity';
import { OnboardingFormResponse } from './entities/onboarding-form-response.entity';
import { OnboardingReview } from './entities/onboarding-review.entity';

/** Matches the jsonb column names on OnboardingFormResponse directly — one source of truth for "what is a section". */
export const FRESHER_SECTIONS = ['personalDetails', 'contactInfo', 'emergencyContact', 'education', 'bankDetails', 'documents'] as const;
export const EXPERIENCED_SECTIONS = ['personalDetails', 'contactInfo', 'emergencyContact', 'education', 'bankDetails', 'employmentHistory', 'documents'] as const;

export type SectionKey = (typeof EXPERIENCED_SECTIONS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  personalDetails: 'Personal Information',
  contactInfo: 'Contact Information',
  emergencyContact: 'Emergency Contact',
  education: 'Education',
  bankDetails: 'Bank Details',
  employmentHistory: 'Previous Employment',
  documents: 'Documents',
};

export function sectionsFor(employeeType: OnboardEmployeeType): SectionKey[] {
  return employeeType === OnboardEmployeeType.EXPERIENCED ? [...EXPERIENCED_SECTIONS] : [...FRESHER_SECTIONS];
}

export function isValidSectionKey(employeeType: OnboardEmployeeType, key: string): key is SectionKey {
  return (sectionsFor(employeeType) as string[]).includes(key);
}

function isSectionFilled(response: OnboardingFormResponse | null, key: SectionKey): boolean {
  if (!response) return false;
  if (key === 'documents') return (response.documents ?? []).length > 0;
  const val = (response as unknown as Record<string, unknown>)[key];
  return !!val && typeof val === 'object' && Object.keys(val as object).length > 0;
}

export function computeCompletion(
  employeeType: OnboardEmployeeType,
  response: OnboardingFormResponse | null,
): { percent: number; sections: Record<string, boolean> } {
  const keys = sectionsFor(employeeType);
  const sections: Record<string, boolean> = {};
  for (const k of keys) sections[k] = isSectionFilled(response, k);
  const done = Object.values(sections).filter(Boolean).length;
  return { percent: keys.length ? Math.round((done / keys.length) * 100) : 0, sections };
}

/**
 * Which sections the candidate may currently write to. Editing is wide open
 * while the form is still fresh/in-progress; once changes are requested it
 * narrows to exactly the sections HR flagged (falling back to "everything",
 * for a changes-requested review created without granular section picks).
 * Every other status (submitted, approved, forwarded, completed) is fully
 * read-only.
 */
export function editableSectionKeys(
  employeeType: OnboardEmployeeType,
  status: OnboardStatus,
  latestReview: Pick<OnboardingReview, 'decision' | 'correctionSections'> | null,
): SectionKey[] {
  const all = sectionsFor(employeeType);
  if (status === OnboardStatus.CHANGES_REQUESTED) {
    const picked = latestReview?.correctionSections?.map((c) => c.section).filter((s) => (all as string[]).includes(s)) as SectionKey[] | undefined;
    return picked && picked.length ? picked : all;
  }
  const openStatuses = [OnboardStatus.INVITATION_SENT, OnboardStatus.LINK_OPENED, OnboardStatus.FORM_IN_PROGRESS];
  return openStatuses.includes(status) ? all : [];
}
