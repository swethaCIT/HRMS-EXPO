import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_NOT_CONFIGURED_MESSAGE, isApiConfigured } from '../config/env';

// The host lives in one place — see src/config/env.ts. Debug builds point at a
// dev machine; release builds require PRODUCTION_API_BASE_URL to be set.
const api = axios.create({ baseURL: API_BASE_URL, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  // Fail loudly rather than firing requests at an empty base URL, which axios
  // would resolve against nothing and report as an opaque network error.
  if (!isApiConfigured) return Promise.reject(new Error(API_NOT_CONFIGURED_MESSAGE));
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Called when the server rejects our token. Registered by the store at startup
 * so this module can trigger a sign-out without importing the store (which
 * would be a require cycle: store → api → store).
 */
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;
export function setSessionExpiredHandler(handler: SessionExpiredHandler) {
  onSessionExpired = handler;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      // Clearing storage alone left Redux still holding a token, so the app kept
      // rendering the signed-in tabs while every request 401'd and each screen
      // quietly swapped in mock data. Drive a real sign-out instead.
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('auth_cache');
      onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (email: string, otp: string, password: string) =>
    api.post('/auth/reset-password', { email, otp, password }),
};

export const onboardingApi = {
  invite: (data: any) => api.post('/onboarding/invite', data),
  verify: (personalEmail: string, code: string) => api.post('/onboarding/verify', { personalEmail, code }),
  complete: (data: any) => api.post('/onboarding/complete', data),
  list: () => api.get('/onboarding'),
};

export const ticketApi = {
  getMine: () => api.get('/tickets/mine'),
  getAll: () => api.get('/tickets'),
  create: (data: any) => api.post('/tickets', data),
  approve: (id: string) => api.patch(`/tickets/${id}/approve`),
  reject: (id: string) => api.patch(`/tickets/${id}/reject`),
  setStatus: (id: string, status: string) => api.patch(`/tickets/${id}/status`, { status }),
  cancel: (id: string) => api.patch(`/tickets/${id}/cancel`),
};

export const employeeApi = {
  getAll: () => api.get('/employees'),
  getOne: (id: string) => api.get(`/employees/${id}`),
  update: (id: string, data: any) => api.patch(`/employees/${id}`, data),
};

export const attendanceApi = {
  checkIn: (employeeId: string, mode: 'office' | 'wfh' = 'office') =>
    api.post(`/attendance/${employeeId}/check-in`, { mode, source: 'manual' }),
  checkOut: (employeeId: string) => api.post(`/attendance/${employeeId}/check-out`),
  today: (employeeId: string) => api.get(`/attendance/today/${employeeId}`),
  getByEmployee: (employeeId: string) => api.get(`/attendance/${employeeId}`),
};

export const leaveApi = {
  create: (data: any) => api.post('/leaves', data),
  getByEmployee: (employeeId: string) => api.get(`/leaves/employee/${employeeId}`),
  getAll: () => api.get('/leaves'),
  balance: (employeeId: string) => api.get(`/leaves/balance/${employeeId}`),
  cancel: (id: string) => api.patch(`/leaves/${id}/cancel`),
};

// Company holiday calendar
export const holidayApi = {
  list: () => api.get('/holidays'),
  create: (data: any) => api.post('/holidays', data),
  remove: (id: string) => api.delete(`/holidays/${id}`),
};

// Company announcements feed
export const announcementApi = {
  list: () => api.get('/announcements'),
  create: (data: any) => api.post('/announcements', data),
  remove: (id: string) => api.delete(`/announcements/${id}`),
};

// Employee document center (Supabase-backed storage)
export const documentApi = {
  byEmployee: (employeeId: string) => api.get(`/documents/employee/${employeeId}`),
  create: (data: any) => api.post('/documents', data),
  remove: (id: string) => api.delete(`/documents/${id}`),
};

export const analyticsApi = {
  summary: () => api.get('/analytics/summary'),
};

export const payrollApi = {
  getByEmployee: (employeeId: string) => api.get(`/payroll/employee/${employeeId}`),
  getAll: () => api.get('/payroll'),
};

export const leaveApprovalApi = {
  approve: (id: string) => api.patch(`/leaves/${id}/approve`),
  reject: (id: string, reason?: string) => api.patch(`/leaves/${id}/reject`, { reason }),
};

export const notificationApi = {
  getMine: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const assetApi = {
  getByEmployee: (employeeId: string) => api.get(`/assets/employee/${employeeId}`),
  getAll: () => api.get('/assets'),
  returnAsset: (id: string) => api.patch(`/assets/${id}/return`),
};

export const regularizationApi = {
  create: (data: any) => api.post('/regularizations', data),
  getByEmployee: (employeeId: string) => api.get(`/regularizations/employee/${employeeId}`),
  getAll: () => api.get('/regularizations'),
  approve: (id: string) => api.patch(`/regularizations/${id}/approve`),
  reject: (id: string, reason?: string) => api.patch(`/regularizations/${id}/reject`, { reason }),
};

export const requestApi = {
  getAll: () => api.get('/requests'),
  getMine: () => api.get('/requests/mine'),
  create: (data: any) => api.post('/requests', data),
  issue: (id: string) => api.patch(`/requests/${id}/issue`),
  reject: (id: string) => api.patch(`/requests/${id}/reject`),
};

/* ── Goals / project boards (Azure-Boards-style PMS) ── */

export const projectApi = {
  list: () => api.get('/projects'),
  getOne: (id: string) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),
  remove: (id: string) => api.delete(`/projects/${id}`),
  // Teams
  teams: (id: string) => api.get(`/projects/${id}/teams`),
  createTeam: (id: string, data: any) => api.post(`/projects/${id}/teams`, data),
  team: (teamId: string) => api.get(`/projects/teams/${teamId}`),
  removeTeam: (teamId: string) => api.delete(`/projects/teams/${teamId}`),
  addMember: (teamId: string, data: any) => api.post(`/projects/teams/${teamId}/members`, data),
  /** Batch add from the member picker — partial success is reported, not fatal. */
  addMembers: (teamId: string, members: any[]) => api.post(`/projects/teams/${teamId}/members/batch`, { members }),
  /** Manager grants/revokes access, or changes a member's role/capacity. */
  updateMember: (memberId: string, data: any) => api.patch(`/projects/teams/members/${memberId}`, data),
  removeMember: (memberId: string) => api.delete(`/projects/teams/members/${memberId}`),
  /** What the signed-in user may do on this team: read | contribute | manage. */
  myAccess: (teamId: string) => api.get(`/projects/teams/${teamId}/my-access`),
  // Sprints
  sprints: (id: string) => api.get(`/projects/${id}/sprints`),
  createSprint: (id: string, data: any) => api.post(`/projects/${id}/sprints`, data),
  // Audit feed
  activity: (id: string, limit?: number) => api.get(`/projects/${id}/activity`, { params: { limit } }),
  // Reports
  report: (id: string) => api.get(`/projects/${id}/report`),
  memberReports: (id: string) => api.get(`/projects/${id}/report/members`),
  memberDetail: (id: string, employeeId: string) => api.get(`/projects/${id}/report/members/${employeeId}`),
};

export const sprintApi = {
  // `teamId` narrows the burndown to a single squad's slice of the sprint.
  burndown: (id: string, teamId?: string) => api.get(`/sprints/${id}/burndown`, { params: { teamId } }),
  /** Every team's curve plus the combined project curve, on shared day labels. */
  burndownByTeam: (id: string) => api.get(`/sprints/${id}/burndown/teams`),
  update: (id: string, data: any) => api.patch(`/sprints/${id}`, data),
  remove: (id: string) => api.delete(`/sprints/${id}`),
};

export const workItemApi = {
  list: (params: Record<string, string | undefined>) => api.get('/work-items', { params }),
  tree: (projectId: string, sprintId?: string) => api.get('/work-items/tree', { params: { projectId, sprintId } }),
  mine: () => api.get('/work-items/mine'),
  getOne: (id: string) => api.get(`/work-items/${id}`),
  create: (data: any) => api.post('/work-items', data),
  update: (id: string, data: any) => api.patch(`/work-items/${id}`, data),
  setState: (id: string, state: string, reason?: string) => api.patch(`/work-items/${id}/state`, { state, reason }),
  remove: (id: string) => api.delete(`/work-items/${id}`),
  logs: (id: string) => api.get(`/work-items/${id}/logs`),
  logWork: (id: string, data: any) => api.post(`/work-items/${id}/logs`, data),
  /** Audit trail for one item: who changed what, when. */
  history: (id: string) => api.get(`/work-items/${id}/history`),
};

/* ── Team Calendar ── */

export const calendarApi = {
  listRange: (start: string, end: string) => api.get('/calendar/events', { params: { start, end } }),
  upcoming: () => api.get('/calendar/upcoming'),
  searchEmployees: (params: { q?: string; page?: number; limit?: number; start?: string; end?: string; excludeEventId?: string }) =>
    api.get('/calendar/employees/search', { params }),
  getOne: (id: string) => api.get(`/calendar/events/${id}`),
  create: (data: any) => api.post('/calendar/events', data),
  // Note: the backend uses PUT (not PATCH) for both edit and RSVP.
  update: (id: string, data: any) => api.put(`/calendar/events/${id}`, data),
  cancel: (id: string) => api.delete(`/calendar/events/${id}`),
  rsvp: (id: string, status: 'Accepted' | 'Declined' | 'Tentative') => api.put(`/calendar/events/${id}/rsvp`, { status }),
};

// Admin user management
export const userApi = {
  getAll: () => api.get('/users'),
  setRole: (id: string, role: string) => api.patch(`/users/${id}`, { role }),
  setActive: (id: string, isActive: boolean) => api.patch(`/users/${id}`, { isActive }),
  remove: (id: string) => api.delete(`/users/${id}`),
};

export default api;
