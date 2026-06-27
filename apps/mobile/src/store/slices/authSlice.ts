import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../../services/api';
import { AuthState } from '../../types';

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(email, password);
      await AsyncStorage.setItem('access_token', data.access_token);
      return data;
    } catch (err: any) {
      // Demo fallback: when the backend isn't running, allow exploring the UI
      // with any credentials. Real auth is used whenever the API is reachable.
      const isNetworkError = !err.response;
      if (isNetworkError) {
        const demo = {
          access_token: 'demo-token',
          user: { id: 'demo', email, name: email.split('@')[0] || 'Demo User', role: 'employee' },
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
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.access_token;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
