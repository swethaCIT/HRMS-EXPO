import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ApprovalItem, APPROVALS_SEED } from '../../data/managerData';
import { leaveApi, leaveApprovalApi } from '../../services/api';

interface ApprovalsState {
  items: ApprovalItem[];
}

const initialState: ApprovalsState = {
  items: APPROVALS_SEED,
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmt = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return d; }
};

/** Map a backend leave row into an approval inbox item. */
function mapLeave(l: any): ApprovalItem {
  const emp = l.employee;
  const name = emp ? `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() : 'Employee';
  const status = l.status === 'approved' ? 'approved' : l.status === 'rejected' ? 'rejected' : 'pending';
  return {
    id: `leave-${l.id}`,
    leaveId: l.id,
    kind: 'leave',
    employeeName: name || (emp?.employeeId ?? 'Employee'),
    employeeId: emp?.employeeId ?? '',
    title: `${cap(l.type)} Leave · ${l.totalDays} day${l.totalDays === 1 ? '' : 's'}`,
    subtitle: `${fmt(l.startDate)} – ${fmt(l.endDate)} 2026`,
    meta: `${l.totalDays}d`,
    submittedAt: 'recently',
    status,
    reason: l.reason,
    detail: [
      { k: 'Type', v: `${cap(l.type)} Leave` },
      { k: 'Duration', v: `${fmt(l.startDate)} – ${fmt(l.endDate)}` },
      { k: 'Working days', v: String(l.totalDays) },
    ],
  };
}

// Pull real leaves and turn them into approval items (kind 'leave').
export const fetchApprovals = createAsyncThunk('approvals/fetch', async () => {
  const { data } = await leaveApi.getAll();
  return (data as any[]).map(mapLeave);
});

const approvalsSlice = createSlice({
  name: 'approvals',
  initialState,
  reducers: {
    approve: (state, action: PayloadAction<string>) => {
      const it = state.items.find((i) => i.id === action.payload);
      if (it) {
        it.status = 'approved';
        if (it.leaveId) leaveApprovalApi.approve(it.leaveId).catch(() => {});
      }
    },
    reject: (state, action: PayloadAction<string>) => {
      const it = state.items.find((i) => i.id === action.payload);
      if (it) {
        it.status = 'rejected';
        if (it.leaveId) leaveApprovalApi.reject(it.leaveId).catch(() => {});
      }
    },
    approveAllPending: (state) => {
      state.items.forEach((i) => {
        if (i.status === 'pending') {
          i.status = 'approved';
          if (i.leaveId) leaveApprovalApi.approve(i.leaveId).catch(() => {});
        }
      });
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchApprovals.fulfilled, (state, action) => {
      if (!action.payload) return;
      // Replace leave-kind items with the real ones; keep the other mock kinds.
      const others = state.items.filter((i) => i.kind !== 'leave');
      state.items = [...action.payload, ...others];
    });
  },
});

export const { approve, reject, approveAllPending } = approvalsSlice.actions;
export default approvalsSlice.reducer;
