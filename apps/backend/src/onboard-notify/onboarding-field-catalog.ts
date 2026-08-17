import { OnboardingRecord } from './entities/onboarding-record.entity';
import { OnboardingFormResponse } from './entities/onboarding-form-response.entity';
import { OnboardDepartment } from './entities/onboarding-forward.entity';

export interface FieldCatalogContext {
  record: OnboardingRecord;
  response: OnboardingFormResponse | null;
  reportingManagerName?: string | null;
}

const fmtDate = (d: Date | string | null | undefined): string | undefined => {
  if (!d) return undefined;
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
};

const fmtObject = (obj: Record<string, any> | null | undefined, keys: string[]): string | undefined => {
  if (!obj) return undefined;
  const parts = keys
    .filter((k) => obj[k] !== undefined && obj[k] !== null && obj[k] !== '')
    .map((k) => `${k}: ${obj[k]}`);
  return parts.length ? parts.join(', ') : undefined;
};

const docSummary = (response: OnboardingFormResponse | null, category?: string): string | undefined => {
  const docs = response?.documents ?? [];
  const filtered = category ? docs.filter((d) => d.category === category) : docs;
  if (!filtered.length) return category ? 'Not uploaded' : undefined;
  return filtered.map((d) => d.name).join(', ');
};

/**
 * Every field HR can choose to forward, and how to render it as a plain-text
 * line for a Notification body. Deliberately whitelist-only: a key not
 * present here can never be forwarded, no matter what a caller sends.
 *
 * This is NOT restricted by department — the department examples in
 * DEFAULT_DEPARTMENT_FIELDS below are just suggested defaults for the HR
 * review UI's pre-checked boxes. HR can pick any subset for any department;
 * the spec is explicit that nothing is automatic and HR decides.
 */
export const ONBOARD_FIELD_CATALOG: Record<string, { label: string; extract: (ctx: FieldCatalogContext) => string | undefined }> = {
  name: { label: 'Name', extract: ({ record }) => record.tempName },
  mobile: { label: 'Mobile', extract: ({ record }) => record.mobile },
  personalEmail: { label: 'Personal Email', extract: ({ record }) => record.email },
  onboardingRef: { label: 'Onboarding Reference', extract: ({ record }) => record.onboardingRef },
  employeeType: { label: 'Employee Type', extract: ({ record }) => record.employeeType },
  department: { label: 'Department', extract: ({ record }) => record.department ?? undefined },
  designation: { label: 'Designation', extract: ({ record }) => record.designation ?? undefined },
  joiningDate: { label: 'Expected Joining Date', extract: ({ record }) => fmtDate(record.expectedJoiningDate) },
  reportingManager: {
    label: 'Reporting Manager',
    extract: ({ record, reportingManagerName }) => reportingManagerName ?? record.reportingManagerId ?? undefined,
  },
  personalDetails: {
    label: 'Personal Details',
    extract: ({ response }) => fmtObject(response?.personalDetails, ['dateOfBirth', 'gender', 'maritalStatus']),
  },
  contactInfo: {
    label: 'Contact Info',
    extract: ({ response }) => fmtObject(response?.contactInfo, ['currentAddress', 'permanentAddress']),
  },
  emergencyContact: {
    label: 'Emergency Contact',
    extract: ({ response }) => fmtObject(response?.emergencyContact, ['name', 'relationship', 'phone']),
  },
  education: {
    label: 'Education',
    extract: ({ response }) => (response?.education?.records?.length ? 'On file (see HR review for details)' : undefined),
  },
  bankDetails: {
    label: 'Bank Details',
    extract: ({ response }) => fmtObject(response?.bankDetails, ['accountHolderName', 'bankName', 'accountNumber', 'ifsc']),
  },
  pan: { label: 'PAN', extract: ({ response }) => docSummary(response, 'pan') },
  identityProof: { label: 'Identity Proof', extract: ({ response }) => docSummary(response, 'identity_proof') },
  employmentHistory: {
    label: 'Previous Employment',
    extract: ({ response }) => {
      const records = response?.employmentHistory?.records as Record<string, any>[] | undefined;
      if (!records?.length) return undefined;
      return records
        .map((r) => fmtObject(r, ['companyName', 'designation', 'totalExperience', 'reasonForLeaving']))
        .filter(Boolean)
        .join(' | ');
    },
  },
  documentRequirements: { label: 'Documents on File', extract: ({ response }) => docSummary(response) },
};

export const DEFAULT_DEPARTMENT_FIELDS: Record<OnboardDepartment, string[]> = {
  [OnboardDepartment.PAYROLL]: ['name', 'onboardingRef', 'bankDetails', 'pan'],
  [OnboardDepartment.IT]: ['name', 'designation', 'department', 'joiningDate', 'reportingManager'],
  [OnboardDepartment.ADMIN]: ['name', 'department', 'joiningDate', 'documentRequirements'],
  [OnboardDepartment.MANAGER]: ['name', 'designation', 'joiningDate', 'employmentHistory'],
};

/** Renders only the HR-approved `fieldKeys` as a plain-text block for a Notification body. Unknown keys are silently dropped (defense-in-depth alongside DTO whitelist validation). */
export function renderFieldsForNotification(fieldKeys: string[], ctx: FieldCatalogContext): string {
  const lines = fieldKeys
    .map((key) => ONBOARD_FIELD_CATALOG[key])
    .filter((entry): entry is (typeof ONBOARD_FIELD_CATALOG)[string] => !!entry)
    .map((entry) => {
      const value = entry.extract(ctx);
      return value ? `${entry.label}: ${value}` : undefined;
    })
    .filter((line): line is string => !!line);
  return lines.join('\n');
}
