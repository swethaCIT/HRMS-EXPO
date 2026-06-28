import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HRRequest, HR_REQUESTS_SEED } from '../../data/hrData';

interface HRRequestsState {
  items: HRRequest[];
}

const initialState: HRRequestsState = {
  items: HR_REQUESTS_SEED,
};

const hrRequestsSlice = createSlice({
  name: 'hrRequests',
  initialState,
  reducers: {
    // "issue" covers issue/approve/complete — the positive action for any kind.
    issue: (state, action: PayloadAction<string>) => {
      const it = state.items.find((i) => i.id === action.payload);
      if (it) it.status = 'issued';
    },
    rejectRequest: (state, action: PayloadAction<string>) => {
      const it = state.items.find((i) => i.id === action.payload);
      if (it) it.status = 'rejected';
    },
    issueAllPending: (state) => {
      state.items.forEach((i) => {
        if (i.status === 'pending') i.status = 'issued';
      });
    },
  },
});

export const { issue, rejectRequest, issueAllPending } = hrRequestsSlice.actions;
export default hrRequestsSlice.reducer;
