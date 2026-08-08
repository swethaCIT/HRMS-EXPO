import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ApprovalItem } from '../../data/managerData';
import { leaveApi, leaveApprovalApi, ticketApi, employeeApi, regularizationApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';

interface ApprovalsState {
  items: ApprovalItem[];
  loading: boolean;
  offline: boolean;
  /** Set when a decision failed to reach the server, so the UI can say so. */
  actionError: string | null;
}

// Start empty — the inbox is populated purely from real backend leaves + tickets,
// so anything an employee submits shows up here for the manager to action.
const initialState: ApprovalsState = {
  items: [],
  loading: false,
  offline: false,
  actionError: null,
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmt = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
};

type EmpInfo = { name: string; employeeId: string };
/** Build a userId → employee-name lookup so tickets (which only carry a createdById) show a real name. */
function buildEmpMap(employees: any[]): Record<string, EmpInfo> {
  const m: Record<string, EmpInfo> = {};
  for (const e of employees || []) {
    const name = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.employeeId || 'Employee';
    const info: EmpInfo = { name, employeeId: e.employeeId ?? '' };
    if (e.user?.id) m[e.user.id] = info;
    if (e.id) m[e.id] = info;
  }
  return m;
}

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
    subtitle: `${fmt(l.startDate)} – ${fmt(l.endDate)}`,
    meta: `${l.totalDays}d`,
    submittedAt: 'recently',
    status,
    reason: l.reason,
    decidedAt: l.decidedAt ? fmt(l.decidedAt) : undefined,
    decisionNote: l.decisionNote || l.rejectionReason || undefined,
    detail: [
      { k: 'Type', v: `${cap(l.type)} Leave` },
      { k: 'Duration', v: `${fmt(l.startDate)} – ${fmt(l.endDate)}` },
      { k: 'Working days', v: String(l.totalDays) },
    ],
  };
}

/** Map a backend ticket row into an approval inbox item. */
function mapTicket(t: any, empMap: Record<string, EmpInfo>): ApprovalItem {
  const emp = empMap[t.createdById];
  const status = t.approval === 'Approved' ? 'approved' : t.approval === 'Rejected' ? 'rejected' : 'pending';
  return {
    id: `ticket-${t.id}`,
    ticketId: t.id,
    kind: 'ticket',
    employeeName: emp?.name ?? 'Employee',
    employeeId: emp?.employeeId ?? '',
    title: t.subject || 'Support Ticket',
    subtitle: `${t.dept ?? ''}${t.category ? ' › ' + t.category : ''}${t.subCategory ? ' › ' + t.subCategory : ''}`.replace(/^ › /, ''),
    meta: t.ticketId || '',
    priority: t.priority,
    submittedAt: 'recently',
    status,
    reason: t.description,
    decidedAt: t.decidedAt ? fmt(t.decidedAt) : undefined,
    decisionNote: t.decisionNote || undefined,
    detail: [
      { k: 'Ticket', v: t.ticketId ?? '' },
      { k: 'Department', v: t.dept ?? '—' },
      { k: 'Category', v: t.category ?? '—' },
      { k: 'Priority', v: t.priority ?? 'Medium' },
      { k: 'Status', v: t.status ?? 'Open' },
    ],
  };
}

const fmtTime = (d?: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
};

/** Map a backend regularization row into an approval inbox item. */
function mapRegularization(r: any): ApprovalItem {
  const emp = r.employee;
  const name = emp ? `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() : 'Employee';
  const status = r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending';
  return {
    id: `regularization-${r.id}`,
    regularizationId: r.id,
    kind: 'regularization',
    employeeName: name || (emp?.employeeId ?? 'Employee'),
    employeeId: emp?.employeeId ?? '',
    title: `Attendance correction · ${fmt(r.date)}`,
    subtitle: `In ${fmtTime(r.requestedCheckIn)} – Out ${fmtTime(r.requestedCheckOut)}`,
    meta: fmt(r.date),
    submittedAt: 'recently',
    status,
    reason: r.reason,
    decidedAt: r.decidedAt ? fmt(r.decidedAt) : undefined,
    decisionNote: r.decisionNote || undefined,
    detail: [
      { k: 'Date', v: fmt(r.date) },
      { k: 'Requested check-in', v: fmtTime(r.requestedCheckIn) },
      { k: 'Requested check-out', v: fmtTime(r.requestedCheckOut) },
    ],
  };
}

// Pull real leaves + tickets + regularizations and turn them into a single approvals inbox.
// `offline` is true whenever any of them couldn't be fetched at all, so the
// screen can tell "genuinely nothing pending" apart from "couldn't reach the server".
export const fetchApprovals = createAsyncThunk('approvals/fetch', async () => {
  const [leavesRes, ticketsRes, regsRes, empRes] = await Promise.allSettled([
    leaveApi.getAll(),
    ticketApi.getAll(),
    regularizationApi.getAll(),
    employeeApi.getAll(),
  ]);
  const employees = empRes.status === 'fulfilled' ? (empRes.value.data as any[]) : [];
  const empMap = buildEmpMap(employees);
  const leaves = leavesRes.status === 'fulfilled' ? (leavesRes.value.data as any[]).map(mapLeave) : [];
  const tickets = ticketsRes.status === 'fulfilled' ? (ticketsRes.value.data as any[]).map((t) => mapTicket(t, empMap)) : [];
  const regularizations = regsRes.status === 'fulfilled' ? (regsRes.value.data as any[]).map(mapRegularization) : [];
  const offline = leavesRes.status === 'rejected' || ticketsRes.status === 'rejected' || regsRes.status === 'rejected';
  // Pending first, then most-recent-looking; leaves, tickets and regularizations interleaved by status.
  return { items: [...leaves, ...tickets, ...regularizations], offline };
});

const approvalsSlice = createSlice({
  name: 'approvals',
  initialState,
  reducers: {
    /** Wipe on sign-out so the next user never inherits these approvals. */
    resetApprovals: () => initialState,
    clearActionError: (state) => { state.actionError = null; },
    /** Local-only status flip. Applied optimistically, reverted if the API call fails. */
    setStatusLocal: (
      state,
      action: PayloadAction<{ id: string; status: ApprovalItem['status']; reason?: string }>,
    ) => {
      const it = state.items.find((i) => i.id === action.payload.id);
      if (!it) return;
      it.status = action.payload.status;
      if (it.reason == null && action.payload.reason) it.reason = action.payload.reason;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchApprovals.pending, (state) => { state.loading = true; })
      .addCase(fetchApprovals.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.items = action.payload.items;
          state.offline = action.payload.offline;
        }
      })
      .addCase(fetchApprovals.rejected, (state) => { state.loading = false; state.offline = true; })
      // A failed decision has already been reverted by the thunk; record why so
      // the screen can tell the manager instead of silently doing nothing.
      .addCase(decideApproval.rejected, (state, action) => {
        state.actionError = (action.payload as string) ?? 'Could not save that decision.';
      })
      .addCase(decideApproval.fulfilled, (state) => { state.actionError = null; })
      .addCase(approveAllPending.fulfilled, (state, action) => {
        const { failed, attempted } = action.payload;
        state.actionError = failed
          ? `${attempted - failed} of ${attempted} approved. ${failed} could not be saved — pull to refresh and retry.`
          : null;
      });
  },
});

export const { resetApprovals, clearActionError, setStatusLocal } = approvalsSlice.actions;

/** Call the right endpoint for whichever record backs this inbox item. */
async function sendDecision(it: ApprovalItem, decision: 'approve' | 'reject', reason?: string) {
  if (it.leaveId) {
    return decision === 'approve' ? leaveApprovalApi.approve(it.leaveId) : leaveApprovalApi.reject(it.leaveId, reason);
  }
  if (it.ticketId) {
    return decision === 'approve' ? ticketApi.approve(it.ticketId) : ticketApi.reject(it.ticketId);
  }
  if (it.regularizationId) {
    return decision === 'approve'
      ? regularizationApi.approve(it.regularizationId)
      : regularizationApi.reject(it.regularizationId, reason);
  }
  // Demo-only rows have no backing record; nothing to send.
  return null;
}

/**
 * Approve or reject, and only keep the change if the server accepted it.
 *
 * These used to run inside a reducer with `.catch(() => {})`: the row flipped to
 * approved, the badge count dropped, and a 401/403 was discarded — so a manager
 * could "Approve All" against an expired session, see an empty inbox, and have
 * changed nothing at all. The item now reverts and the error surfaces.
 */
export const decideApproval = createAsyncThunk(
  'approvals/decide',
  async (
    { id, decision, reason }: { id: string; decision: 'approve' | 'reject'; reason?: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as { approvals: ApprovalsState };
    const item = state.approvals.items.find((i) => i.id === id);
    if (!item) return rejectWithValue('That request is no longer in the inbox.');

    const previous = item.status;
    const target: ApprovalItem['status'] = decision === 'approve' ? 'approved' : 'rejected';
    dispatch(setStatusLocal({ id, status: target, reason }));

    try {
      await sendDecision(item, decision, reason);
      return { id, status: target };
    } catch (err) {
      dispatch(setStatusLocal({ id, status: previous }));
      return rejectWithValue(getErrorMessage(err, `Could not ${decision} this request.`));
    }
  },
);

/** Approve every pending item, reporting exactly how many actually succeeded. */
export const approveAllPending = createAsyncThunk(
  'approvals/approveAll',
  async (_: void, { getState, dispatch }) => {
    const state = getState() as { approvals: ApprovalsState };
    const pending = state.approvals.items.filter((i) => i.status === 'pending');
    const results = await Promise.allSettled(
      pending.map((i) => dispatch(decideApproval({ id: i.id, decision: 'approve' })).unwrap()),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    return { attempted: pending.length, succeeded, failed: pending.length - succeeded };
  },
);
export default approvalsSlice.reducer;
