import { configureStore } from '@reduxjs/toolkit';
import authReducer, { sessionExpired } from './slices/authSlice';
import approvalsReducer, { resetApprovals } from './slices/approvalsSlice';
import hrRequestsReducer, { resetHRRequests } from './slices/hrRequestsSlice';
import notificationsReducer, { resetNotifications } from './slices/notificationsSlice';
import calendarReducer, { clearCalendar } from './slices/calendarSlice';
import { setSessionExpiredHandler } from '../services/api';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    approvals: approvalsReducer,
    hrRequests: hrRequestsReducer,
    notifications: notificationsReducer,
    calendar: calendarReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * When the API reports 401 the session is over: clear auth AND every other
 * slice, so the next person to sign in on this device never sees the previous
 * user's approvals, requests, notifications or calendar entries.
 */
/** Clear every per-user slice. Shared by explicit sign-out and 401 expiry. */
export function clearUserData() {
  store.dispatch(resetApprovals());
  store.dispatch(resetHRRequests());
  store.dispatch(resetNotifications());
  store.dispatch(clearCalendar());
}

setSessionExpiredHandler(() => {
  store.dispatch(sessionExpired());
  clearUserData();
});
