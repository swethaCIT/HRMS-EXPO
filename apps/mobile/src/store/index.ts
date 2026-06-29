import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import approvalsReducer from './slices/approvalsSlice';
import hrRequestsReducer from './slices/hrRequestsSlice';
import notificationsReducer from './slices/notificationsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    approvals: approvalsReducer,
    hrRequests: hrRequestsReducer,
    notifications: notificationsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
