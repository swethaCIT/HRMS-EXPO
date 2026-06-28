import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import approvalsReducer from './slices/approvalsSlice';
import hrRequestsReducer from './slices/hrRequestsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    approvals: approvalsReducer,
    hrRequests: hrRequestsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
