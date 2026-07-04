import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import {
  PRIORITIES, STATUS_STYLE, APPROVAL_STYLE,
  Ticket, TicketStatus,
} from '../../data/ticketTaxonomy';
import { ticketApi } from '../../services/api';

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function mapTicket(t: any): Ticket {
  return {
    id: t.ticketId || t.id,
    subject: t.subject,
    dept: t.dept,
    category: t.category,
    subCategory: t.subCategory,
    priority: t.priority,
    status: t.status,
    approval: t.approval,
    createdAt: fmtDate(t.createdAt),
    agent: t.agent,
    description: t.description,
    timeline: [{ label: 'Ticket submitted', at: fmtDate(t.createdAt), by: 'You' }],
  };
}

const DEPT_ICON: Record<string, string> = { HR: '🧑‍💼', IT: '💻', Admin: '🗂️', Others: '❓' };

const INITIAL: Ticket[] = [
  {
    id: 'TKT-1043', subject: 'Laptop not powering on after update',
    dept: 'IT', category: 'Hardware', subCategory: 'Laptop Issue',
    priority: 'High', status: 'In Progress', approval: 'Approved',
    createdAt: '26 Jun 2026', agent: 'IT Helpdesk',
    description: 'My laptop does not power on after the latest Windows update. The charging light blinks but the screen stays black even after a hard reset.',
    notify: ['Karthik R.', 'Priya S.'],
    timeline: [
      { label: 'Ticket submitted',        at: '26 Jun 2026, 09:12 AM', by: 'You' },
      { label: 'Approved by HOD',         at: '26 Jun 2026, 10:05 AM', by: 'Manager' },
      { label: 'Assigned to IT Helpdesk', at: '26 Jun 2026, 10:30 AM', by: 'System' },
      { label: 'Diagnosis in progress',   at: '26 Jun 2026, 02:15 PM', by: 'IT Helpdesk', note: 'Motherboard check scheduled.' },
    ],
  },
  {
    id: 'TKT-1039', subject: 'Form 16 for FY 2025-26 not available',
    dept: 'HR', category: 'Payroll & Benefits', subCategory: 'Form 16',
    priority: 'Medium', status: 'Open', approval: 'Pending',
    createdAt: '24 Jun 2026',
    description: 'Form 16 for the financial year 2025-26 is not showing up in the payroll portal. Need it for filing income tax returns.',
    notify: ['Priya S.'],
    timeline: [
      { label: 'Ticket submitted',  at: '24 Jun 2026, 04:40 PM', by: 'You' },
      { label: 'Awaiting approval', at: null },
    ],
  },
  {
    id: 'TKT-1031', subject: 'VPN access request for remote work',
    dept: 'IT', category: 'Access Management', subCategory: 'VPN Access',
    priority: 'Low', status: 'Resolved', approval: 'Approved',
    createdAt: '20 Jun 2026', agent: 'Network Team',
    description: 'Requesting VPN access to connect to internal resources while working remotely.',
    timeline: [
      { label: 'Ticket submitted',        at: '20 Jun 2026, 11:00 AM', by: 'You' },
      { label: 'Approved by HOD',         at: '20 Jun 2026, 12:30 PM', by: 'Manager' },
      { label: 'Assigned to Network Team', at: '20 Jun 2026, 01:00 PM', by: 'System' },
      { label: 'VPN access granted',      at: '21 Jun 2026, 09:45 AM', by: 'Network Team', note: 'Credentials shared over secure email.' },
    ],
  },
  {
    id: 'TKT-1024', subject: 'Reset password for HRMS portal',
    dept: 'Admin', category: 'User Management', subCategory: 'Reset Password',
    priority: 'Critical', status: 'Closed', approval: 'Rejected',
    createdAt: '15 Jun 2026', agent: 'Admin',
    description: 'Unable to log in to the HRMS portal. Requesting a password reset.',
    timeline: [
      { label: 'Ticket submitted', at: '15 Jun 2026, 08:20 AM', by: 'You' },
      { label: 'Rejected',         at: '15 Jun 2026, 09:00 AM', by: 'Admin', note: 'Use the self-service "Forgot Password" link instead.' },
    ],
  },
];

const FILTERS: ('All' | TicketStatus)[] = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export default function TicketsScreen({ navigation, route }: any) {
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL);
  const [filter, setFilter]   = useState<'All' | TicketStatus>('All');

  /* fetch my real tickets on mount (fall back to mock when offline) */
  const loadTickets = React.useCallback(async () => {
    try {
      const { data } = await ticketApi.getMine();
      if (Array.isArray(data)) setTickets(data.map(mapTicket));
    } catch { /* keep mock */ }
  }, []);
  useEffect(() => { loadTickets(); }, [loadTickets]);

  /* a freshly-raised ticket comes back from the wizard → persist then refresh */
  useEffect(() => {
    const nt = route?.params?.newTicket;
    if (!nt) return;
    (async () => {
      try {
        await ticketApi.create({
          subject: nt.subject, dept: nt.dept, category: nt.category,
          subCategory: nt.subCategory, priority: nt.priority, description: nt.description,
        });
        await loadTickets();
      } catch {
        // offline: optimistic local add
        const created: Ticket = {
          id: `TKT-${1044 + tickets.length}`,
          subject: nt.subject, dept: nt.dept, category: nt.category, subCategory: nt.subCategory,
          priority: nt.priority, status: 'Open', approval: 'Pending', createdAt: '27 Jun 2026',
          description: nt.description, notify: nt.notify, attachments: nt.attachments,
          timeline: [{ label: 'Ticket submitted', at: '27 Jun 2026, 10:00 AM', by: 'You' }, { label: 'Awaiting approval', at: null }],
        };
        setTickets(prev => [created, ...prev]);
      }
      navigation.setParams({ newTicket: undefined });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.newTicket]);

  const visible = filter === 'All' ? tickets : tickets.filter(t => t.status === filter);

  const counts = {
    open: tickets.filter(t => t.status === 'Open').length,
    progress: tickets.filter(t => t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length,
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.headerBack}>←</Text>
            </TouchableOpacity>
          )}
          <View>
            <Text style={s.headerTitle}>Tickets</Text>
            <Text style={s.headerSub}>{tickets.length} total · {counts.open + counts.progress} active</Text>
          </View>
        </View>
      </View>

      {/* ── Stat strip ── */}
      <View style={s.statStrip}>
        <View style={s.statItem}>
          <Text style={[s.statNum, { color: '#60A5FA' }]}>{counts.open}</Text>
          <Text style={s.statLabel}>Open</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={[s.statNum, { color: '#FBBF24' }]}>{counts.progress}</Text>
          <Text style={s.statLabel}>In Progress</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={[s.statNum, { color: '#34D399' }]}>{counts.resolved}</Text>
          <Text style={s.statLabel}>Resolved</Text>
        </View>
      </View>

      {/* ── Filter chips ── */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterChip, filter === f && s.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Ticket list ── */}
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96, paddingTop: 8 }}>
        {visible.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 38 }}>🎫</Text>
            <Text style={s.emptyText}>No {filter !== 'All' ? filter.toLowerCase() : ''} tickets</Text>
          </View>
        )}

        {visible.map(t => {
          const st  = STATUS_STYLE[t.status];
          const pri = PRIORITIES.find(p => p.key === t.priority)!;
          const ap  = APPROVAL_STYLE[t.approval];
          return (
            <TouchableOpacity
              key={t.id}
              style={s.card}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('TicketDetail', { ticket: t })}
            >
              <View style={s.cardTop}>
                <View style={s.deptTag}>
                  <Text style={s.deptTagIcon}>{DEPT_ICON[t.dept] ?? '🎫'}</Text>
                  <Text style={s.deptTagText}>{t.dept}</Text>
                </View>
                <Text style={s.ticketId}>{t.id}</Text>
                <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[s.statusText, { color: st.color }]}>{t.status}</Text>
                </View>
              </View>

              <Text style={s.subject} numberOfLines={2}>{t.subject}</Text>
              <Text style={s.path}>{t.category} › {t.subCategory}</Text>

              {/* approval row */}
              <View style={s.approvalRow}>
                <View style={[s.approvalBadge, { backgroundColor: ap.bg }]}>
                  <Text style={[s.approvalText, { color: ap.color }]}>{ap.icon} {t.approval}</Text>
                </View>
                <Text style={s.approvalHint}>
                  {t.approval === 'Pending'  ? 'Awaiting manager approval'
                    : t.approval === 'Approved' ? 'Approved · being handled'
                    : 'Request rejected'}
                </Text>
              </View>

              <View style={s.cardFooter}>
                <View style={[s.priChip, { backgroundColor: pri.bg }]}>
                  <View style={[s.priDot, { backgroundColor: pri.color }]} />
                  <Text style={[s.priText, { color: pri.color }]}>{t.priority}</Text>
                </View>
                <Text style={s.metaText}>
                  {t.agent ? `${t.agent} · ` : ''}{t.createdAt}  ›
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Raise a Ticket FAB ── */}
      <View style={s.fabWrap}>
        <TouchableOpacity
          style={s.fab}
          activeOpacity={0.85}
          onPress={() => navigation?.navigate('RaiseTicket')}
        >
          <Text style={s.fabPlus}>＋</Text>
          <Text style={s.fabText}>Raise a Ticket</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    backgroundColor: '#1E1B4B',
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  headerBack:  { fontSize: 26, color: '#FFF', fontWeight: '600' },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText:  { color: '#FFF', fontWeight: '700', fontSize: 12 },

  /* stat strip */
  statStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1B4B', paddingBottom: 18, paddingHorizontal: 20,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statNum:     { fontSize: 22, fontWeight: '800' },
  statLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

  /* filter */
  filterBar: { backgroundColor: '#FFF', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterChip:       { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#4F46E5' },
  filterText:       { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  filterTextActive: { color: '#FFF' },

  scroll: { flex: 1 },

  /* card */
  card: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  deptTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deptTagIcon: { fontSize: 11 },
  deptTagText: { fontSize: 11, fontWeight: '700', color: '#4F46E5' },
  ticketId:    { flex: 1, fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginLeft: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontSize: 10, fontWeight: '700' },

  subject: { fontSize: 15, fontWeight: '700', color: '#1F2937', lineHeight: 21 },
  path:    { fontSize: 12, color: '#6B7280', marginTop: 4 },

  approvalRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  approvalBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  approvalText:  { fontSize: 11, fontWeight: '700' },
  approvalHint:  { fontSize: 11, color: '#9CA3AF', flex: 1 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  priChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  priDot:  { width: 7, height: 7, borderRadius: 4 },
  priText: { fontSize: 11, fontWeight: '700' },
  metaText:{ fontSize: 11, color: '#9CA3AF' },

  /* empty */
  empty:     { alignItems: 'center', paddingTop: 70, gap: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

  /* fab */
  fabWrap: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  fab: {
    backgroundColor: '#4F46E5', borderRadius: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    elevation: 6, shadowColor: '#4F46E5', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  fabPlus: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  fabText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
