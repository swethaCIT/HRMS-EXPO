/* ════════════════════════════════════════════════════════
   Ticket taxonomy: Department → Category → Sub Category
   Used by the Raise-a-Ticket wizard.
   ════════════════════════════════════════════════════════ */

export interface TicketCategory {
  label: string;
  subcategories: string[];
}

export interface TicketDepartment {
  key: string;
  label: string;
  icon: string;          // emoji
  slaHours: number;      // typical resolution time
  categories: TicketCategory[];
}

export const DEPARTMENTS: TicketDepartment[] = [
  {
    key: 'HR',
    label: 'HR',
    icon: '🧑‍💼',
    slaHours: 48,
    categories: [
      {
        label: 'Employee Management',
        subcategories: [
          'Employee Information Update',
          'Employee Transfer',
          'Employment Verification',
          'Experience Letter',
          'Relieving Letter',
          'ID Card Request',
          'Address Change',
          'Personal Details Update',
        ],
      },
      {
        label: 'Attendance & Leave',
        subcategories: [
          'Missing Punch',
          'Attendance Regularization',
          'Shift Change',
          'Overtime',
          'Leave Balance',
          'Leave Cancellation',
          'Leave Approval Issue',
        ],
      },
      {
        label: 'Payroll & Benefits',
        subcategories: [
          'Payslip',
          'Salary Issue',
          'Tax Query',
          'Form 16',
          'PF / EPF',
          'ESI',
          'Bonus',
          'Reimbursement',
          'Insurance',
        ],
      },
      {
        label: 'Recruitment',
        subcategories: [
          'Interview Schedule',
          'Candidate Status',
          'Offer Letter',
          'Referral',
          'Background Verification',
        ],
      },
      {
        label: 'Performance',
        subcategories: [
          'Goal Setting',
          'KPI Update',
          'Performance Review',
          'Promotion',
          'Appraisal',
        ],
      },
      {
        label: 'Documents',
        subcategories: [
          'Salary Certificate',
          'Bonafide Certificate',
          'Appointment Letter',
          'Offer Letter',
          'HR Letter',
        ],
      },
      {
        label: 'Others',
        subcategories: [
          'General HR Query',
          'Complaint',
          'Suggestion',
          'Other Request',
        ],
      },
    ],
  },

  {
    key: 'IT',
    label: 'IT',
    icon: '💻',
    slaHours: 24,
    categories: [
      {
        label: 'Hardware',
        subcategories: [
          'Laptop Issue',
          'Desktop Issue',
          'Monitor',
          'Keyboard',
          'Mouse',
          'Printer',
          'Headset',
          'Webcam',
        ],
      },
      {
        label: 'Software',
        subcategories: [
          'Software Installation',
          'Software Update',
          'License Request',
          'Office 365',
          'Adobe',
          'Visual Studio',
          'Application Crash',
        ],
      },
      {
        label: 'Access Management',
        subcategories: [
          'Password Reset',
          'Account Unlock',
          'Email Access',
          'Shared Folder Access',
          'HRMS Access',
          'VPN Access',
          'GitHub Access',
          'Jira Access',
        ],
      },
      {
        label: 'Network',
        subcategories: [
          'Internet',
          'Wi-Fi',
          'LAN',
          'VPN',
          'Slow Network',
          'DNS',
        ],
      },
      {
        label: 'Infrastructure',
        subcategories: [
          'Server Access',
          'Server Issue',
          'Firewall',
          'Storage',
          'Proxy',
          'Load Balancer',
        ],
      },
      {
        label: 'Virtual Machines',
        subcategories: [
          'New VM',
          'VM Access',
          'VM Restart',
          'VM Resize',
          'VM Backup',
          'VM Restore',
          'RDP Access',
          'SSH Access',
        ],
      },
      {
        label: 'Database',
        subcategories: [
          'SQL Access',
          'MySQL',
          'PostgreSQL',
          'Oracle',
          'MongoDB',
          'Backup',
          'Restore',
        ],
      },
      {
        label: 'Cloud',
        subcategories: [
          'Azure',
          'AWS',
          'Google Cloud',
          'Storage',
          'Key Vault',
          'Virtual Network',
        ],
      },
      {
        label: 'Others',
        subcategories: [
          'General IT Issue',
          'Device Not Listed',
          'Software Not Listed',
          'Other Technical Issue',
        ],
      },
    ],
  },

  {
    key: 'Admin',
    label: 'Admin',
    icon: '🗂️',
    slaHours: 36,
    categories: [
      {
        label: 'User Management',
        subcategories: [
          'Create User',
          'Update User',
          'Disable User',
          'Delete User',
          'Unlock User',
          'Reset Password',
        ],
      },
      {
        label: 'Roles & Permissions',
        subcategories: [
          'Assign Role',
          'Modify Role',
          'Remove Permission',
          'Access Request',
        ],
      },
      {
        label: 'Organization Setup',
        subcategories: [
          'Department',
          'Team',
          'Branch',
          'Holiday Calendar',
          'Shift Setup',
        ],
      },
      {
        label: 'Audit & Compliance',
        subcategories: [
          'Audit Log',
          'Login History',
          'Security Review',
          'Activity Report',
        ],
      },
      {
        label: 'Backup & Recovery',
        subcategories: [
          'Backup Request',
          'Restore Request',
          'Archive Data',
          'Retention Policy',
        ],
      },
      {
        label: 'System Configuration',
        subcategories: [
          'Email Configuration',
          'Notification Setup',
          'Workflow Configuration',
          'API Configuration',
        ],
      },
      {
        label: 'Others',
        subcategories: [
          'General Admin Query',
          'Configuration Request',
          'System Issue',
          'Other Administrative Request',
        ],
      },
    ],
  },

  {
    key: 'Others',
    label: 'Others',
    icon: '❓',
    slaHours: 48,
    categories: [
      {
        label: 'General',
        subcategories: [
          'General Inquiry',
          'Complaint',
          'Suggestion',
          'Feedback',
          'Request',
          'Other',
        ],
      },
    ],
  },
];

/* ── Priority ── */
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export const PRIORITIES: { key: Priority; color: string; bg: string }[] = [
  { key: 'Low',      color: '#10B981', bg: '#D1FAE5' },
  { key: 'Medium',   color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'High',     color: '#EF4444', bg: '#FEE2E2' },
  { key: 'Critical', color: '#7C3AED', bg: '#EDE9FE' },
];

/* ── Work mode ── */
export const WORK_MODES = ['Office', 'Remote', 'Hybrid'] as const;
export type WorkMode = typeof WORK_MODES[number];

/* ── Ticket status & approval ── */
export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type Approval     = 'Pending' | 'Approved' | 'Rejected';

export interface TimelineEvent {
  label: string;
  at: string | null;     // null = not reached yet
  by?: string;
  note?: string;
}

export interface Ticket {
  id: string;
  subject: string;
  dept: string;
  category: string;
  subCategory: string;
  priority: Priority;
  status: TicketStatus;
  approval: Approval;
  createdAt: string;
  agent?: string;
  description?: string;
  notify?: string[];
  attachments?: string[];
  timeline?: TimelineEvent[];
}

export const STATUS_STYLE: Record<TicketStatus, { color: string; bg: string }> = {
  'Open':        { color: '#2563EB', bg: '#DBEAFE' },
  'In Progress': { color: '#B45309', bg: '#FEF3C7' },
  'Resolved':    { color: '#065F46', bg: '#D1FAE5' },
  'Closed':      { color: '#6B7280', bg: '#F3F4F6' },
};

export const APPROVAL_STYLE: Record<Approval, { color: string; bg: string; icon: string }> = {
  'Pending':  { color: '#B45309', bg: '#FEF3C7', icon: '⏳' },
  'Approved': { color: '#065F46', bg: '#D1FAE5', icon: '✓' },
  'Rejected': { color: '#991B1B', bg: '#FEE2E2', icon: '✕' },
};

/* Build the stage tracker for a ticket from its status + approval. */
export function buildTracker(t: Ticket): { label: string; done: boolean; current: boolean; rejected?: boolean }[] {
  if (t.approval === 'Rejected') {
    return [
      { label: 'Submitted',        done: true,  current: false },
      { label: 'Pending Approval', done: true,  current: false },
      { label: 'Rejected',         done: true,  current: true, rejected: true },
    ];
  }
  const order: TicketStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
  const idx = order.indexOf(t.status);
  const approved = t.approval === 'Approved';
  return [
    { label: 'Submitted',        done: true,                       current: false },
    { label: 'Pending Approval', done: approved,                   current: !approved },
    { label: 'Approved',         done: approved && idx >= 0,       current: approved && t.status === 'Open' },
    { label: 'In Progress',      done: idx >= 1,                   current: t.status === 'In Progress' },
    { label: 'Resolved',         done: idx >= 2,                   current: t.status === 'Resolved' || t.status === 'Closed' },
  ];
}

/* ── Mock directory for "Notify To" ── */
export interface Person { id: string; name: string; initials: string; }

export const DIRECTORY: Person[] = [
  { id: 'u1', name: 'Karthik R.', initials: 'KR' },
  { id: 'u2', name: 'Priya S.',   initials: 'PS' },
  { id: 'u3', name: 'Arjun M.',   initials: 'AM' },
  { id: 'u4', name: 'Sneha T.',   initials: 'ST' },
  { id: 'u5', name: 'Rahul V.',   initials: 'RV' },
  { id: 'u6', name: 'Divya N.',   initials: 'DN' },
];
