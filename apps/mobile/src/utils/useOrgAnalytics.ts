import { useCallback, useState } from 'react';
import { analyticsApi } from '../services/api';
import { useLivePolling } from './useLivePolling';
import type { Presence } from '../data/managerData';

/* ════════════════════════════════════════════════════════
   Live org analytics, shared by the manager/HR dashboards, the team and
   people directories, and the insight screens.

   These screens used to render module-level fixtures — the same invented
   "86% present · 7 members", attrition curve and birthday list for every
   user, under a pulsing LIVE badge. This hook replaces that with the real
   figures and, crucially, reports `loaded` so a screen can show an honest
   empty/offline state instead of silently falling back to fiction.
   ════════════════════════════════════════════════════════ */

export interface PresenceCounts {
  in: number;
  remote: number;
  leave: number;
  out: number;
  total: number;
  available: number;
  availablePct: number;
}

export interface NewJoiner {
  id: string;
  name: string;
  designation: string | null;
  department: string | null;
  dateOfJoining: string;
}

export interface Celebration {
  kind: 'birthday' | 'anniversary';
  name: string;
  department: string | null;
  day: number;
  years: number | null;
}

export interface OrgSummary {
  headcount: number;
  departments: number;
  headcountByDept: { label: string; value: number }[];
  genderSplit: { label: string; value: number }[];
  leaveDistribution: { label: string; value: number }[];
  attendanceTrend: number[];
  attendanceLabels: string[];
  avgAttendance: number;
  leaveDaysApproved: number;
  presence: PresenceCounts;
  newJoiners: NewJoiner[];
  celebrations: Celebration[];
  attrition: { byMonth: { label: string; value: number }[]; separated: number; ratePct: number };
}

export interface DirectoryPerson {
  id: string;
  employeeId: string;
  name: string;
  designation: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  presence: Presence;
  checkIn: string | null;
  pendingRequests: number;
}

/** Org summary. `loaded` false + `offline` true means show an honest error, not fixtures. */
export function useOrgSummary(intervalMs = 30_000) {
  const [data, setData] = useState<OrgSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: res } = await analyticsApi.summary();
      setData(res);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  useLivePolling(useCallback(() => { load(); }, [load]), intervalMs);
  return { data, loaded, offline, reload: load };
}

/** Employee directory with today's presence. */
export function useDirectory(intervalMs = 30_000) {
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await analyticsApi.directory();
      setPeople(Array.isArray(data?.employees) ? data.employees : []);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  useLivePolling(useCallback(() => { load(); }, [load]), intervalMs);
  return { people, loaded, offline, reload: load };
}
