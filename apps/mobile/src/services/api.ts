import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000/api/v1'  // Android emulator → localhost
  : 'https://your-production-url.com/api/v1';

const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('access_token');
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
};

export const ticketApi = {
  getMine: () => api.get('/tickets/mine'),
  getAll: () => api.get('/tickets'),
  create: (data: any) => api.post('/tickets', data),
  approve: (id: string) => api.patch(`/tickets/${id}/approve`),
  reject: (id: string) => api.patch(`/tickets/${id}/reject`),
  setStatus: (id: string, status: string) => api.patch(`/tickets/${id}/status`, { status }),
};

export const employeeApi = {
  getAll: () => api.get('/employees'),
  getOne: (id: string) => api.get(`/employees/${id}`),
  update: (id: string, data: any) => api.patch(`/employees/${id}`, data),
};

export const attendanceApi = {
  checkIn: (employeeId: string) => api.post(`/attendance/${employeeId}/check-in`),
  checkOut: (employeeId: string) => api.post(`/attendance/${employeeId}/check-out`),
  getByEmployee: (employeeId: string) => api.get(`/attendance/${employeeId}`),
};

export const leaveApi = {
  create: (data: any) => api.post('/leaves', data),
  getByEmployee: (employeeId: string) => api.get(`/leaves/employee/${employeeId}`),
  getAll: () => api.get('/leaves'),
};

export const payrollApi = {
  getByEmployee: (employeeId: string) => api.get(`/payroll/employee/${employeeId}`),
  getAll: () => api.get('/payroll'),
};

export const leaveApprovalApi = {
  approve: (id: string) => api.patch(`/leaves/${id}/approve`),
  reject: (id: string) => api.patch(`/leaves/${id}/reject`),
};

export const notificationApi = {
  getMine: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

// Admin user management
export const userApi = {
  getAll: () => api.get('/users'),
  setRole: (id: string, role: string) => api.patch(`/users/${id}`, { role }),
  setActive: (id: string, isActive: boolean) => api.patch(`/users/${id}`, { isActive }),
  remove: (id: string) => api.delete(`/users/${id}`),
};

export default api;
