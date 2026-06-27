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

export default api;
