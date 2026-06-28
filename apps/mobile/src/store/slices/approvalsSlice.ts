import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ApprovalItem, APPROVALS_SEED } from '../../data/managerData';

interface ApprovalsState {
  items: ApprovalItem[];
}

const initialState: ApprovalsState = {
  items: APPROVALS_SEED,
};

const approvalsSlice = createSlice({
  name: 'approvals',
  initialState,
  reducers: {
    approve: (state, action: PayloadAction<string>) => {
      const it = state.items.find((i) => i.id === action.payload);
      if (it) it.status = 'approved';
    },
    reject: (state, action: PayloadAction<string>) => {
      const it = state.items.find((i) => i.id === action.payload);
      if (it) it.status = 'rejected';
    },
    /** Approve every still-pending item (bulk action from the inbox). */
    approveAllPending: (state) => {
      state.items.forEach((i) => {
        if (i.status === 'pending') i.status = 'approved';
      });
    },
  },
});

export const { approve, reject, approveAllPending } = approvalsSlice.actions;
export default approvalsSlice.reducer;
