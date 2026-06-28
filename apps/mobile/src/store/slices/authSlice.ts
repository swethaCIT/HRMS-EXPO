import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../../services/api';
import { AuthState, User } from '../../types';

/** Infer a role from the email when the API doesn't supply one (demo / legacy tokens). */
export function roleFromEmail(email: string): User['role'] {
  const e = (email || '').toLowerCase();
  if (e.startsWith('admin') || e.includes('admin')) return 'admin';
  if (e.includes('hr')) return 'hr';
  if (e.includes('manager') || e.includes('lead') || e.includes('head') || e.includes('mgr')) return 'manager';
  return 'employee';
}

export const MANAGER_ROLES: User['role'][] = ['admin', 'hr', 'manager'];
export const isManagerRole = (role?: User['role']) => !!role && MANAGER_ROLES.includes(role);
const defaultViewFor = (role?: User['role']): AuthState['viewMode'] =>
  isManagerRole(role) ? 'manager' : 'employee';

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(email, password);
      await AsyncStorage.setItem('access_token', data.access_token);
      // Backend currently returns { id, email } only — fill in a role if missing.
      const user: User = { ...data.user, role: data.user?.role || roleFromEmail(email) };
      return { access_token: data.access_token, user };
    } catch (err: any) {
      // Demo fallback: when the backend isn't running, allow exploring the UI
      // with any credentials. Real auth is used whenever the API is reachable.
      const isNetworkError = !err.response;
      if (isNetworkError) {
        const demo = {
          access_token: 'demo-token',
          user: {
            id: 'demo',
            email,
            role: roleFromEmail(email),
            isActive: true,
          } as User,
        };
        await AsyncStorage.setItem('access_token', demo.access_token);
        return demo;
      }
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  },
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.removeItem('access_token');
});

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
  viewMode: 'employee',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setViewMode: (state, action: { payload: AuthState['viewMode'] }) => {
      state.viewMode = action.payload;
    },
    toggleViewMode: (state) => {
      state.viewMode = state.viewMode === 'manager' ? 'employee' : 'manager';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.access_token;
        state.user = action.payload.user as User;
        state.viewMode = defaultViewFor(action.payload.user?.role);
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.viewMode = 'employee';
      });
  },
});

export const { clearError, setViewMode, toggleViewMode } = authSlice.actions;
export default authSlice.reducer;
