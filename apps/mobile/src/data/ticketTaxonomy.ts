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
