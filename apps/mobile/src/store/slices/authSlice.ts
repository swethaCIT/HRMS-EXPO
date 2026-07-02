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

/** Which management experience a role gets. */
export const managementKind = (role?: User['role']): 'admin' | 'hr' | 'manager' | null => {
  if (role === 'admin') return 'admin';
  if (role === 'hr') return 'hr';
  if (role === 'manager') return 'manager';
  return null;
};

const defaultViewFor = (role?: User['role']): AuthState['viewMode'] =>
  isManagerRole(role) ? 'manager' : 'employee';

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(email, password);
      await AsyncStorage.setItem('access_token', data.access_token);
      // Backend currently returns { id, email } only — fill in a role if missing.
      let user: User = { ...data.user, role: data.user?.role || roleFromEmail(email) };
      // Pull the full profile (role + employee record) now that the token is stored.
      let employee = null;
      try {
        const me = await authApi.me();
        if (me.data?.user) user = { ...user, ...me.data.user };
        employee = me.data?.employee ?? null;
      } catch { /* /me optional — keep login data */ }
      // Cache profile so we can restore the session offline (see restoreSession).
      await AsyncStorage.setItem('auth_cache', JSON.stringify({ user, employee }));
      return { access_token: data.access_token, user, employee };
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
          employee: null,
        };
        await AsyncStorage.setItem('access_token', demo.access_token);
        return demo;
      }
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  },
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.removeItem('access_token'); await AsyncStorage.removeItem('auth_cache');
});

/**
 * Restore a saved session on launch. Resilient: only signs the user out on a real
 * 401 (invalid/expired token). On a transient network error it keeps the cached
 * session so a flaky connection at startup doesn't kick the user to the login screen.
 */
export const restoreSession = createAsyncThunk('auth/restore', async (_, { rejectWithValue }) => {
  const token = await AsyncStorage.getItem('access_token');
  if (!token || token === 'demo-token') return rejectWithValue('no-session');
  const cachedRaw = await AsyncStorage.getItem('auth_cache');
  const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
  try {
    const me = await authApi.me();
    const user: User = { ...me.data.user, role: me.data.user?.role };
    const employee = me.data.employee ?? null;
    await AsyncStorage.setItem('auth_cache', JSON.stringify({ user, employee }));
    return { access_token: token, user, employee };
  } catch (err: any) {
    if (err?.response?.status === 401) {
      await AsyncStorage.removeItem('access_token'); await AsyncStorage.removeItem('auth_cache');
      return rejectWithValue('invalid-session');
    }
    // Network/other error — keep the session using the cached profile if we have it.
    if (cached?.user) return { access_token: token, user: cached.user, employee: cached.employee ?? null };
    return rejectWithValue('offline-no-cache');
  }
});

const initialState: AuthState = {
  user: null,
  employee: null,
  token: null,
  isLoading: false,
  error: null,
  viewMode: 'employee',
  booting: true,
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
    /** Establish a session directly (used after onboarding self-registration auto-login). */
    setSession: (state, action: { payload: { access_token: string; user: User; employee?: any } }) => {
      state.token = action.payload.access_token;
      state.user = { ...action.payload.user, role: action.payload.user?.role || roleFromEmail(action.payload.user?.email || '') };
      state.employee = action.payload.employee ?? null;
      state.viewMode = defaultViewFor(state.user?.role);
      state.booting = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.access_token;
        state.user = action.payload.user as User;
        state.employee = (action.payload as any).employee ?? null;
        state.viewMode = defaultViewFor(action.payload.user?.role);
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.employee = null;
        state.token = null;
        state.viewMode = 'employee';
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.booting = false;
        state.token = action.payload.access_token;
        state.user = action.payload.user as User;
        state.employee = (action.payload as any).employee ?? null;
        state.viewMode = defaultViewFor(action.payload.user?.role);
      })
      .addCase(restoreSession.rejected, (state) => {
        state.booting = false;
      });
  },
});

export const { clearError, setViewMode, toggleViewMode, setSession } = authSlice.actions;
export default authSlice.reducer;
