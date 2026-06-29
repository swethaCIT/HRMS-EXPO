import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { notificationApi } from '../../services/api';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;       // info | approval | leave | payroll | ticket | system
  read: boolean;
  createdAt: string;
}

const MOCK: NotificationItem[] = [
  { id: 'mock-1', title: 'Welcome to HRMS', body: 'Notifications will appear here once the backend is connected.', type: 'info', read: false, createdAt: new Date(0).toISOString() },
];

export const fetchNotifications = createAsyncThunk('notifications/fetch', async () => {
  try {
    const { data } = await notificationApi.getMine();
    return data as NotificationItem[];
  } catch {
    return MOCK; // graceful offline fallback
  }
});

interface NotificationsState {
  items: NotificationItem[];
  loading: boolean;
}
const initialState: NotificationsState = { items: [], loading: false };

const slice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    markReadLocal: (state, action: PayloadAction<string>) => {
      const n = state.items.find((i) => i.id === action.payload);
      if (n) n.read = true;
      // fire-and-forget server update
      notificationApi.markRead(action.payload).catch(() => {});
    },
    markAllReadLocal: (state) => {
      state.items.forEach((i) => (i.read = true));
      notificationApi.markAllRead().catch(() => {});
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.loading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchNotifications.rejected, (state) => { state.loading = false; });
  },
});

export const { markReadLocal, markAllReadLocal } = slice.actions;
export default slice.reducer;
