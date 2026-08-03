/* ════════════════════════════════════════════════════════
   Goals / project board — shared types and design tokens.

   Colour language: the app's own palette (deep-indigo headers, indigo accent,
   soft cards) for chrome, plus the familiar Azure Boards work-item hues for the
   item types and workflow states so the board reads the way people expect.
   ════════════════════════════════════════════════════════ */

import { T } from '../../data/managerData';

export type WorkItemType = 'epic' | 'feature' | 'user_story' | 'task' | 'bug';
export type WorkItemState = 'new' | 'active' | 'resolved' | 'closed' | 'removed';
export type ProjectStatus = 'active' | 'on_hold' | 'completed';
export type SprintStatus = 'future' | 'current' | 'completed';

export interface WorkItem {
  id: string;
  seq: number;
  projectId: string;
  sprintId?: string | null;
  teamId?: string | null;
  parentId?: string | null;
  type: WorkItemType;
  title: string;
  description?: string;
  state: WorkItemState;
  reason?: string;
  priority: number;
  assigneeId?: string | null;
  assigneeName?: string | null;
  storyPoints: number;
  originalEstimate: number;
  remainingWork: number;
  completedWork: number;
  tags?: string[] | null;
  startDate?: string | null;
  targetDate?: string | null;
  activatedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  createdByName?: string | null;
  /** Present on tree responses — totals rolled up from all descendants. */
  rollup?: { total: number; closed: number; progress: number; estimated: number; remaining: number; completed: number; points: number };
  children?: WorkItem[];
}

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  color?: string;
  startDate?: string;
  targetDate?: string;
  ownerName?: string;
  itemsTotal: number;
  itemsClosed: number;
  itemsActive: number;
  overdue: number;
  progress: number;
  teamCount: number;
  memberCount: number;
  sprintCount: number;
  currentSprint?: { id: string; name: string; endDate: string } | null;
}

/* ── Work-item types (Azure hierarchy: Epic → Feature → User Story → Task/Bug) ── */
export const TYPE_META: Record<WorkItemType, { label: string; short: string; solid: string; bg: string; fg: string; glyph: string }> = {
  epic:       { label: 'Epic',       short: 'EPI', solid: '#F97316', bg: '#FFF1E6', fg: '#9A3412', glyph: '◆' },
  feature:    { label: 'Feature',    short: 'FEA', solid: '#7C3AED', bg: '#EDE9FE', fg: '#5B21B6', glyph: '⬟' },
  user_story: { label: 'User Story', short: 'STY', solid: '#0EA5E9', bg: '#E0F2FE', fg: '#0369A1', glyph: '▣' },
  task:       { label: 'Task',       short: 'TSK', solid: '#EAB308', bg: '#FEF9C3', fg: '#854D0E', glyph: '▪' },
  bug:        { label: 'Bug',        short: 'BUG', solid: '#DC2626', bg: '#FEE2E2', fg: '#991B1B', glyph: '⬢' },
};

/** Depth in the hierarchy — drives the backlog tree indent. */
export const TYPE_DEPTH: Record<WorkItemType, number> = {
  epic: 0, feature: 1, user_story: 2, task: 3, bug: 3,
};

/** What a given type is allowed to contain (mirrors the backend rule). */
export const ALLOWED_CHILDREN: Record<WorkItemType, WorkItemType[]> = {
  epic: ['feature'],
  feature: ['user_story'],
  user_story: ['task', 'bug'],
  task: [],
  bug: ['task'],
};

/* ── Workflow states ── */
export const STATE_META: Record<WorkItemState, { label: string; solid: string; bg: string; fg: string }> = {
  new:      { label: 'New',      solid: '#9CA3AF', bg: '#F3F4F6', fg: '#4B5563' },
  active:   { label: 'Active',   solid: '#2563EB', bg: '#DBEAFE', fg: '#1D4ED8' },
  resolved: { label: 'Resolved', solid: '#F59E0B', bg: '#FEF3C7', fg: '#B45309' },
  closed:   { label: 'Closed',   solid: '#10B981', bg: '#D1FAE5', fg: '#065F46' },
  removed:  { label: 'Removed',  solid: '#D1D5DB', bg: '#F9FAFB', fg: '#9CA3AF' },
};

/** Board columns, in workflow order. Removed is deliberately not a column. */
export const BOARD_COLUMNS: WorkItemState[] = ['new', 'active', 'resolved', 'closed'];
export const ALL_STATES: WorkItemState[] = ['new', 'active', 'resolved', 'closed', 'removed'];

/** Where an item can go next — keeps state changes to sensible moves. */
export function nextStates(state: WorkItemState): WorkItemState[] {
  switch (state) {
    case 'new':      return ['active', 'removed'];
    case 'active':   return ['resolved', 'closed', 'new'];
    case 'resolved': return ['closed', 'active'];
    case 'closed':   return ['active'];
    case 'removed':  return ['new'];
    default:         return [];
  }
}

/* ── Priority ── */
export const PRIORITY_META: Record<number, { label: string; solid: string; bg: string; fg: string }> = {
  1: { label: 'P1', solid: '#EF4444', bg: '#FEE2E2', fg: '#991B1B' },
  2: { label: 'P2', solid: '#F59E0B', bg: '#FEF3C7', fg: '#B45309' },
  3: { label: 'P3', solid: '#3B82F6', bg: '#DBEAFE', fg: '#1D4ED8' },
  4: { label: 'P4', solid: '#9CA3AF', bg: '#F3F4F6', fg: '#4B5563' },
};

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; bg: string; fg: string }> = {
  active:    { label: 'Active',    bg: T.green.bg, fg: T.green.fg },
  on_hold:   { label: 'On hold',   bg: T.amber.bg, fg: T.amber.fg },
  completed: { label: 'Completed', bg: '#EEF2FF',  fg: T.primary },
};

export const SPRINT_STATUS_META: Record<SprintStatus, { label: string; bg: string; fg: string }> = {
  future:    { label: 'Future',    bg: '#F3F4F6', fg: '#4B5563' },
  current:   { label: 'Current',   bg: '#DBEAFE', fg: '#1D4ED8' },
  completed: { label: 'Completed', bg: T.green.bg, fg: T.green.fg },
};

/* ── Formatting helpers ── */

/** "ATLAS-42" — the reference people quote in standups. */
export const refOf = (key: string | undefined, seq: number) => `${key || '#'}-${seq}`;

export const fmtHours = (h?: number | null) => {
  const v = Number(h || 0);
  return v % 1 === 0 ? `${v}h` : `${v.toFixed(1)}h`;
};

export const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtShortDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

/** "in 4 days" / "2 days ago" / "today" */
export function relativeDays(iso?: string | null): string {
  if (!iso) return '—';
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return '—';
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const n = new Date();
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const days = Math.round((a - b) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export function isOverdue(item: { targetDate?: string | null; state: WorkItemState }): boolean {
  if (!item.targetDate || item.state === 'closed') return false;
  const d = new Date(item.targetDate);
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() < new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

/** Flatten a work-item tree depth-first, tagging each node with its depth. */
export function flattenTree(nodes: WorkItem[], depth = 0, out: { item: WorkItem; depth: number }[] = []) {
  for (const n of nodes) {
    out.push({ item: n, depth });
    if (n.children?.length) flattenTree(n.children, depth + 1, out);
  }
  return out;
}

export { T };
