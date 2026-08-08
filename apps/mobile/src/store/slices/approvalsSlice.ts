import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ApprovalItem } from '../../data/managerData';
import { leaveApi, leaveApprovalApi, ticketApi, employeeApi, regularizationApi } from '../../services/api';

interface ApprovalsState {
  items: ApprovalItem[];
  loading: boolean;
  offline: boolean;
}

// Start empty — the inbox is populated purely from real backend leaves + tickets,
// so anything an employee submits shows up here for the manager to action.
const initialState: ApprovalsState = {
  items: [],
  loading: false,
  offline: false,
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
    approve: (state, action: PayloadAction<string>) => {
      const it = state.items.find((i) => i.id === action.payload);
      if (!it) return;
      it.status = 'approved';
      if (it.leaveId) leaveApprovalApi.approve(it.leaveId).catch(() => {});
      if (it.ticketId) ticketApi.approve(it.ticketId).catch(() => {});
      if (it.regularizationId) regularizationApi.approve(it.regularizationId).catch(() => {});
    },
    reject: (state, action: PayloadAction<string | { id: string; reason?: string }>) => {
      const id = typeof action.payload === 'string' ? action.payload : action.payload.id;
      const reason = typeof action.payload === 'string' ? undefined : action.payload.reason;
      const it = state.items.find((i) => i.id === id);
      if (!it) return;
      it.status = 'rejected';
      if (it.reason == null && reason) it.reason = reason;
      if (it.leaveId) leaveApprovalApi.reject(it.leaveId, reason).catch(() => {});
      if (it.ticketId) ticketApi.reject(it.ticketId).catch(() => {});
      if (it.regularizationId) regularizationApi.reject(it.regularizationId, reason).catch(() => {});
    },
    approveAllPending: (state) => {
      state.items.forEach((i) => {
        if (i.status !== 'pending') return;
        i.status = 'approved';
        if (i.leaveId) leaveApprovalApi.approve(i.leaveId).catch(() => {});
        if (i.ticketId) ticketApi.approve(i.ticketId).catch(() => {});
        if (i.regularizationId) regularizationApi.approve(i.regularizationId).catch(() => {});
      });
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
      .addCase(fetchApprovals.rejected, (state) => { state.loading = false; state.offline = true; });
  },
});

export const { approve, reject, approveAllPending, resetApprovals } = approvalsSlice.actions;
export default approvalsSlice.reducer;
