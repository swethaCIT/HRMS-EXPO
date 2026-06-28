import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import approvalsReducer from './slices/approvalsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    approvals: approvalsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
