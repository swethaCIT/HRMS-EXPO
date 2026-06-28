/* ════════════════════════════════════════════════════════
   HR module — org-wide data. Reuses the same design tokens and
   TeamMember shape as the manager module so the two experiences
   stay visually and structurally uniform.
   ════════════════════════════════════════════════════════ */

import { T, TINT, TeamMember, TEAM } from './managerData';

export { T, TINT };

/* ── Org-wide people (manager's team + the rest of the company) ── */
const EXTRA_PEOPLE: TeamMember[] = [
  { id: 'h1', employeeId: 'EMP009', name: 'Meera Iyer',     designation: 'HR Generalist',    department: 'People',    email: 'meera.i@hrms.com',  phone: '+91 90000 00009', presence: 'in',     checkIn: '09:05 AM', attendancePct: 97, leaveBalance: 13, utilization: 0,  performance: 89, pending: 0, projects: ['Onboarding'] },
  { id: 'h2', employeeId: 'EMP010', name: 'Aditya Kapoor',  designation: 'Sales Manager',     department: 'Sales',     email: 'aditya.k@hrms.com', phone: '+91 90000 00010', presence: 'remote', checkIn: '09:25 AM', attendancePct: 91, leaveBalance: 7,  utilization: 85, performance: 86, pending: 0, projects: ['Enterprise'] },
  { id: 'h3', employeeId: 'EMP011', name: 'Fatima Khan',    designation: 'Finance Analyst',   department: 'Finance',   email: 'fatima.k@hrms.com', phone: '+91 90000 00011', presence: 'in',     checkIn: '08:50 AM', attendancePct: 95, leaveBalance: 10, utilization: 80, performance: 88, pending: 0, projects: ['Payroll'] },
  { id: 'h4', employeeId: 'EMP012', name: 'Joseph Paul',    designation: 'Talent Sourcer',    department: 'People',    email: 'joseph.p@hrms.com', phone: '+91 90000 00012', presence: 'leave',                     attendancePct: 88, leaveBalance: 3,  utilization: 0,  performance: 82, pending: 0, projects: ['Hiring'] },
];

export const HR_PEOPLE: TeamMember[] = [...TEAM, ...EXTRA_PEOPLE];

/* ── HR request inbox (documents, letters, profile changes, onboarding) ── */
export type HRRequestKind = 'document' | 'leave' | 'profile' | 'onboarding';
export type HRRequestStatus = 'pending' | 'issued' | 'rejected';

export const HR_KIND_META: Record<HRRequestKind, { label: string; icon: string; tint: keyof typeof TINT; action: string }> = {
  document:   { label: 'Document Request', icon: '📄', tint: 'blue',   action: 'Issue' },
  leave:      { label: 'Leave Approval',   icon: '🏖️', tint: 'amber',  action: 'Approve' },
  profile:    { label: 'Profile Change',   icon: '✏️', tint: 'purple', action: 'Approve' },
  onboarding: { label: 'Onboarding',       icon: '🚀', tint: 'green',  action: 'Complete' },
};

export interface HRRequest {
  id: string;
  kind: HRRequestKind;
  employeeName: string;
  employeeId: string;
  department: string;
  title: string;
  subtitle: string;
  meta: string;
  submittedAt: string;
  status: HRRequestStatus;
  reason?: string;
  detail: { k: string; v: string }[];
}

export const HR_REQUESTS_SEED: HRRequest[] = [
  {
    id: 'HR-3001', kind: 'document', employeeName: 'Rahul Verma', employeeId: 'EMP006', department: 'Engineering',
    title: 'Experience Letter', subtitle: 'For home loan application', meta: 'EXP',
    submittedAt: '1 h ago', status: 'pending', reason: 'Bank requires an experience letter for loan processing.',
    detail: [{ k: 'Document', v: 'Experience Letter' }, { k: 'Purpose', v: 'Home loan' }, { k: 'Tenure', v: '2 yr 3 mo' }, { k: 'Format', v: 'PDF · signed' }],
  },
  {
    id: 'HR-3002', kind: 'document', employeeName: 'Priya Sharma', employeeId: 'EMP003', department: 'Design',
    title: 'Salary Certificate', subtitle: 'Visa application', meta: 'SAL',
    submittedAt: '3 h ago', status: 'pending', reason: 'Required for Schengen visa application.',
    detail: [{ k: 'Document', v: 'Salary Certificate' }, { k: 'Purpose', v: 'Visa' }, { k: 'Period', v: 'FY 2025-26' }],
  },
  {
    id: 'HR-3003', kind: 'profile', employeeName: 'Arjun Mehta', employeeId: 'EMP004', department: 'Engineering',
    title: 'Bank Account Update', subtitle: 'New salary account', meta: 'BANK',
    submittedAt: '6 h ago', status: 'pending', reason: 'Switched banks, please update for next payroll run.',
    detail: [{ k: 'Field', v: 'Bank account' }, { k: 'New bank', v: 'HDFC ••• 4821' }, { k: 'Effective', v: 'Next payroll' }],
  },
  {
    id: 'HR-3004', kind: 'onboarding', employeeName: 'Joseph Paul', employeeId: 'EMP012', department: 'People',
    title: 'Day-1 Onboarding', subtitle: 'Pending document verification', meta: 'NEW',
    submittedAt: '1 d ago', status: 'pending', reason: 'New joiner — verify ID proofs and issue assets.',
    detail: [{ k: 'Stage', v: 'Document verification' }, { k: 'Joined', v: '26 Jun 2026' }, { k: 'Buddy', v: 'Meera Iyer' }],
  },
  {
    id: 'HR-3005', kind: 'leave', employeeName: 'Aditya Kapoor', employeeId: 'EMP010', department: 'Sales',
    title: 'Comp-off · 1 day', subtitle: 'Worked on 21 Jun (Sat)', meta: '1 day',
    submittedAt: '1 d ago', status: 'pending', reason: 'Closed the enterprise deal over the weekend.',
    detail: [{ k: 'Type', v: 'Compensatory off' }, { k: 'For', v: '21 Jun 2026' }, { k: 'Take on', v: '30 Jun 2026' }],
  },
];

/* ── Org analytics for HR Insights ── */
export const ORG_HEADCOUNT = [
  { label: 'Engineering', value: 4, color: '#4F46E5' },
  { label: 'People',      value: 2, color: '#EC4899' },
  { label: 'Design',      value: 1, color: '#0EA5E9' },
  { label: 'Quality',     value: 1, color: '#10B981' },
  { label: 'Sales',       value: 1, color: '#F59E0B' },
  { label: 'Finance',     value: 1, color: '#8B5CF6' },
  { label: 'Analytics',   value: 1, color: '#14B8A6' },
];

export const ATTRITION_TREND = [6, 5, 7, 4, 5, 3]; // last 6 months, % (lower is better)
export const ATTRITION_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

export const GENDER_SPLIT = [
  { label: 'Men',         value: 6, color: '#4F46E5' },
  { label: 'Women',       value: 4, color: '#EC4899' },
  { label: 'Undisclosed', value: 1, color: '#9CA3AF' },
];

export const NEW_JOINERS = [
  { name: 'Joseph Paul',   role: 'Talent Sourcer', when: 'Joined 2 days ago' },
  { name: 'Fatima Khan',   role: 'Finance Analyst', when: 'Joined 3 weeks ago' },
];

export const CELEBRATIONS = [
  { name: 'Sneha Thomas', type: '🎂 Birthday', when: 'Today' },
  { name: 'Karthik Raja', type: '🎉 3-yr anniversary', when: 'Tomorrow' },
  { name: 'Divya Nair',   type: '🎂 Birthday', when: 'In 4 days' },
];
