/* ════════════════════════════════════════════════════════
   Manager module — shared design tokens, types and mock data.
   Mirrors the visual language used across the employee app
   (deep-indigo headers #1E1B4B, indigo accent #4F46E5, soft cards).
   ════════════════════════════════════════════════════════ */

import { Priority } from './ticketTaxonomy';

/* ── Design tokens (single source of truth for the manager screens) ── */
export const T = {
  bg:        '#F3F4F6',
  header:    '#1E1B4B',
  headerAlt: '#312E81',
  primary:   '#4F46E5',
  card:      '#FFFFFF',
  ink:       '#1F2937',
  sub:       '#6B7280',
  faint:     '#9CA3AF',
  line:      '#E5E7EB',
  // status palette
  green:  { fg: '#065F46', bg: '#D1FAE5', solid: '#10B981' },
  amber:  { fg: '#B45309', bg: '#FEF3C7', solid: '#F59E0B' },
  red:    { fg: '#991B1B', bg: '#FEE2E2', solid: '#EF4444' },
  blue:   { fg: '#2563EB', bg: '#DBEAFE', solid: '#3B82F6' },
  purple: { fg: '#5B21B6', bg: '#EDE9FE', solid: '#7C3AED' },
};

/* Deterministic avatar colour from a name (no Math.random for stable renders). */
const AVATAR_COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
export function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}

/* ── Presence ── */
export type Presence = 'in' | 'remote' | 'leave' | 'out';
export const PRESENCE_META: Record<Presence, { label: string; dot: string; chipBg: string; chipFg: string }> = {
  in:     { label: 'In office', dot: '#10B981', chipBg: '#D1FAE5', chipFg: '#065F46' },
  remote: { label: 'Remote',    dot: '#3B82F6', chipBg: '#DBEAFE', chipFg: '#2563EB' },
  leave:  { label: 'On leave',  dot: '#F59E0B', chipBg: '#FEF3C7', chipFg: '#B45309' },
  out:    { label: 'Not in',    dot: '#9CA3AF', chipBg: '#F3F4F6', chipFg: '#6B7280' },
};

/* ── Team members ── */
export interface TeamMember {
  id: string;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  presence: Presence;
  checkIn?: string;
  attendancePct: number;   // 0-100, rolling 30 days
  leaveBalance: number;    // days
  utilization: number;     // 0-100 billable
  performance: number;     // 0-100 last review
  pending: number;         // pending approvals raised by this member
  projects: string[];
}

export const TEAM: TeamMember[] = [
  { id: 'm1', employeeId: 'EMP002', name: 'Karthik Raja',  designation: 'Senior Engineer', department: 'Engineering', email: 'karthik.r@hrms.com', phone: '+91 90000 00002', presence: 'in',     checkIn: '09:02 AM', attendancePct: 96, leaveBalance: 11, utilization: 88, performance: 92, pending: 1, projects: ['Atlas API', 'Payments'] },
  { id: 'm2', employeeId: 'EMP003', name: 'Priya Sharma',  designation: 'Product Designer', department: 'Design',      email: 'priya.s@hrms.com',   phone: '+91 90000 00003', presence: 'remote', checkIn: '09:20 AM', attendancePct: 93, leaveBalance: 8,  utilization: 81, performance: 88, pending: 1, projects: ['Design System'] },
  { id: 'm3', employeeId: 'EMP004', name: 'Arjun Mehta',   designation: 'Backend Engineer', department: 'Engineering', email: 'arjun.m@hrms.com',   phone: '+91 90000 00004', presence: 'leave',                     attendancePct: 90, leaveBalance: 4,  utilization: 79, performance: 84, pending: 1, projects: ['Atlas API'] },
  { id: 'm4', employeeId: 'EMP005', name: 'Sneha Thomas',  designation: 'QA Lead',          department: 'Quality',     email: 'sneha.t@hrms.com',   phone: '+91 90000 00005', presence: 'in',     checkIn: '08:55 AM', attendancePct: 98, leaveBalance: 14, utilization: 84, performance: 90, pending: 0, projects: ['Atlas API', 'Mobile'] },
  { id: 'm5', employeeId: 'EMP006', name: 'Rahul Verma',   designation: 'Frontend Engineer',department: 'Engineering', email: 'rahul.v@hrms.com',   phone: '+91 90000 00006', presence: 'remote', checkIn: '09:34 AM', attendancePct: 87, leaveBalance: 9,  utilization: 76, performance: 79, pending: 1, projects: ['Mobile'] },
  { id: 'm6', employeeId: 'EMP007', name: 'Divya Nair',    designation: 'Data Analyst',     department: 'Analytics',   email: 'divya.n@hrms.com',   phone: '+91 90000 00007', presence: 'out',                       attendancePct: 82, leaveBalance: 6,  utilization: 70, performance: 81, pending: 0, projects: ['Insights'] },
  { id: 'm7', employeeId: 'EMP008', name: 'Vikram Singh',  designation: 'DevOps Engineer',  department: 'Platform',    email: 'vikram.s@hrms.com',  phone: '+91 90000 00008', presence: 'in',     checkIn: '09:10 AM', attendancePct: 94, leaveBalance: 12, utilization: 90, performance: 87, pending: 0, projects: ['Infra'] },
];

/* ── Approvals (unified inbox) ── */
export type ApprovalKind = 'leave' | 'ticket' | 'regularization' | 'expense';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export const KIND_META: Record<ApprovalKind, { label: string; icon: string; tint: keyof typeof TINT }> = {
  leave:          { label: 'Leave Request',    icon: '🏖️', tint: 'amber' },
  ticket:         { label: 'Ticket Approval',  icon: '🎫', tint: 'blue' },
  regularization: { label: 'Regularization',   icon: '⏱️', tint: 'purple' },
  expense:        { label: 'Expense Claim',    icon: '🧾', tint: 'green' },
};
export const TINT = {
  amber: T.amber, blue: T.blue, purple: T.purple, green: T.green, red: T.red,
};

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  employeeName: string;
  employeeId: string;
  title: string;
  subtitle: string;
  meta: string;            // right-aligned (date / amount / days)
  priority?: Priority;
  submittedAt: string;
  status: ApprovalStatus;
  reason?: string;
  // kind-specific detail rows shown on the expanded card
  detail: { k: string; v: string }[];
  /** Present when this item is backed by a real DB leave row (enables real approve/reject). */
  leaveId?: string;
  /** Present when this item is backed by a real DB ticket row (enables real approve/reject). */
  ticketId?: string;
}

export const APPROVALS_SEED: ApprovalItem[] = [
  {
    id: 'AP-2010', kind: 'leave', employeeName: 'Arjun Mehta', employeeId: 'EMP004',
    title: 'Annual Leave · 3 days', subtitle: '10 Jul – 12 Jul 2026', meta: '3 days',
    submittedAt: '2 h ago', status: 'pending', reason: 'Family function out of town.',
    detail: [
      { k: 'Type', v: 'Annual Leave' }, { k: 'Duration', v: '10 Jul – 12 Jul 2026' },
      { k: 'Working days', v: '3' }, { k: 'Balance after', v: '1 day' },
      { k: 'Backup', v: 'Sneha Thomas' },
    ],
  },
  {
    id: 'AP-2011', kind: 'regularization', employeeName: 'Rahul Verma', employeeId: 'EMP006',
    title: 'Missed Punch-out', subtitle: '25 Jun 2026 · forgot to check out', meta: '25 Jun',
    priority: 'Medium', submittedAt: '4 h ago', status: 'pending', reason: 'Left for client call, forgot to punch out.',
    detail: [
      { k: 'Date', v: '25 Jun 2026' }, { k: 'Recorded in', v: '09:34 AM' },
      { k: 'Requested out', v: '06:45 PM' }, { k: 'Total hours', v: '9h 11m' },
    ],
  },
  {
    id: 'AP-2012', kind: 'ticket', employeeName: 'Karthik Raja', employeeId: 'EMP002',
    title: 'VPN access for production', subtitle: 'IT › Access Management › VPN Access', meta: 'TKT-1051',
    priority: 'High', submittedAt: '5 h ago', status: 'pending', reason: 'Need prod VPN to debug the payments incident.',
    detail: [
      { k: 'Department', v: 'IT' }, { k: 'Category', v: 'Access Management' },
      { k: 'Priority', v: 'High' }, { k: 'SLA', v: '24 h' },
    ],
  },
  {
    id: 'AP-2013', kind: 'expense', employeeName: 'Priya Sharma', employeeId: 'EMP003',
    title: 'Client dinner reimbursement', subtitle: 'Travel & Meals · receipt attached', meta: '₹4,820',
    submittedAt: '1 d ago', status: 'pending', reason: 'Dinner with the Atlas client during onsite.',
    detail: [
      { k: 'Category', v: 'Travel & Meals' }, { k: 'Amount', v: '₹4,820' },
      { k: 'Date', v: '22 Jun 2026' }, { k: 'Receipt', v: 'dinner_receipt.pdf' },
    ],
  },
  {
    id: 'AP-2014', kind: 'leave', employeeName: 'Priya Sharma', employeeId: 'EMP003',
    title: 'Sick Leave · 1 day', subtitle: '28 Jun 2026', meta: '1 day',
    submittedAt: '1 d ago', status: 'pending', reason: 'Fever, will work from home if better.',
    detail: [
      { k: 'Type', v: 'Sick Leave' }, { k: 'Duration', v: '28 Jun 2026' },
      { k: 'Working days', v: '1' }, { k: 'Balance after', v: '7 days' },
    ],
  },
];

/* ── Analytics series for the Insights screen ── */
export const ATTENDANCE_TREND = [88, 91, 86, 94, 90, 96, 93]; // last 7 working days (%)
export const TREND_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const LEAVE_SPLIT = [
  { label: 'Annual',    value: 9,  color: '#4F46E5' },
  { label: 'Sick',      value: 5,  color: '#F59E0B' },
  { label: 'Casual',    value: 3,  color: '#10B981' },
  { label: 'Unpaid',    value: 1,  color: '#EF4444' },
];

export const DEPT_HEADCOUNT = [
  { label: 'Engineering', value: 4, color: '#4F46E5' },
  { label: 'Design',      value: 1, color: '#EC4899' },
  { label: 'Quality',     value: 1, color: '#10B981' },
  { label: 'Analytics',   value: 1, color: '#F59E0B' },
];

/* ── Announcements composed by the manager ── */
export interface Announcement { id: string; title: string; body: string; at: string; audience: string; }
export const ANNOUNCEMENTS_SEED: Announcement[] = [
  { id: 'AN-1', title: 'Sprint 24 demo on Friday', body: 'Please have your demo branches merged by Thu EOD.', at: 'Yesterday', audience: 'Engineering' },
  { id: 'AN-2', title: 'Quarterly reviews open', body: 'Self-appraisals due by 5 Jul. Book a 1:1 slot.', at: '3 days ago', audience: 'All team' },
];
