export interface User {
  id: string;
  email: string;
  role: 'admin' | 'hr' | 'manager' | 'employee';
  isActive: boolean;
}

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  department?: string;
  designation?: string;
  dateOfJoining?: string;
  dateOfBirth?: string;
  employmentType: string;
  status: string;
  avatarUrl?: string;
  user: User;
  // enterprise HR fields
  grade?: string;
  workLocation?: string;
  workMode?: string;
  reportingManager?: string;
  gender?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  nationality?: string;
  personalEmail?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  pan?: string;
  uan?: string;
  bankName?: string;
  bankLast4?: string;
}

export interface Attendance {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  notes?: string;
}

export interface Leave {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
}

export interface Payroll {
  id: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  tax: number;
  netSalary: number;
  status: string;
  paymentDate?: string;
}

export interface AuthState {
  user: User | null;
  /** The signed-in user's employee record (from /auth/me); null for demo/no profile. */
  employee: Employee | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  /** Which experience the signed-in user is currently viewing. */
  viewMode: 'manager' | 'employee';
  /** True while restoring a saved session on app launch. */
  booting: boolean;
}
