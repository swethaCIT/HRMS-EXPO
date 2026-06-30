import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { HRRequest, HR_REQUESTS_SEED } from '../../data/hrData';
import { requestApi } from '../../services/api';

interface HRRequestsState {
  items: HRRequest[];
}

const initialState: HRRequestsState = {
  items: HR_REQUESTS_SEED,
};

function mapRequest(r: any): HRRequest {
  return {
    id: r.id,
    kind: r.kind,
    employeeName: r.employeeName,
    employeeId: r.employeeId,
    department: r.department,
    title: r.title,
    subtitle: r.subtitle,
    meta: r.meta,
    submittedAt: 'recently',
    status: r.status,
    reason: r.reason,
    detail: Array.isArray(r.detail) ? r.detail : [],
  };
}

// Pull real HR requests from the backend.
export const fetchHRRequests = createAsyncThunk('hrRequests/fetch', async () => {
  const { data } = await requestApi.getAll();
  return (data as any[]).map(mapRequest);
});

const hrRequestsSlice = createSlice({
  name: 'hrRequests',
  initialState,
  reducers: {
    issue: (state, action: PayloadAction<string>) => {
      const it = state.items.find((i) => i.id === action.payload);
      if (it) { it.status = 'issued'; requestApi.issue(it.id).catch(() => {}); }
    },
    rejectRequest: (state, action: PayloadAction<string>) => {
      const it = state.items.find((i) => i.id === action.payload);
      if (it) { it.status = 'rejected'; requestApi.reject(it.id).catch(() => {}); }
    },
    issueAllPending: (state) => {
      state.items.forEach((i) => {
        if (i.status === 'pending') { i.status = 'issued'; requestApi.issue(i.id).catch(() => {}); }
      });
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchHRRequests.fulfilled, (state, action) => {
      if (action.payload && action.payload.length) state.items = action.payload;
    });
  },
});

export const { issue, rejectRequest, issueAllPending } = hrRequestsSlice.actions;
export default hrRequestsSlice.reducer;
