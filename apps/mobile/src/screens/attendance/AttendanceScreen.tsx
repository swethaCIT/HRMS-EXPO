import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, Modal, TextInput,
} from 'react-native';

const { width } = Dimensions.get('window');

/* ── Types ── */
interface Session {
  inTime: string;
  outTime: string | null;
}

interface DayEntry {
  date: Date;
  sessions: Session[];
  totalMins: number;
  firstIn: string;
  lastOut: string | null;
  status: 'ON TIME' | 'LATE' | 'WFH';
  type: 'office' | 'wfh' | 'leave' | 'weekend';
}

interface RegRequest {
  id: string;
  dateStr: string;
  inTime: string;
  outTime: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

/* ── Helpers ── */
function timeToMins(t: string): number {
  const parts = t.split(' ');
  const [h, m] = parts[0].split(':').map(Number);
  const period = parts[1];
  let hrs = h % 12;
  if (period === 'PM') hrs += 12;
  return hrs * 60 + m;
}

function minsToHM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function dk(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(d: Date): string {
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function rangeLabel(s: Date, e: Date): string {
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${s.getDate()} ${mo[s.getMonth()]} – ${e.getDate()} ${mo[e.getMonth()]}`;
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
}

/* ── Mock attendance sessions (replace with API data) ── */
const SESSION_MAP: Record<string, Session[]> = {
  '2026-06-22': [
    { inTime: '09:14 AM', outTime: '01:15 PM' },
    { inTime: '02:00 PM', outTime: '06:45 PM' },
  ],
  '2026-06-23': [
    { inTime: '08:05 AM', outTime: '06:12 PM' },
  ],
  '2026-06-24': [
    { inTime: '09:00 AM', outTime: '11:45 AM' },
    { inTime: '12:30 PM', outTime: '04:00 PM' },
    { inTime: '04:20 PM', outTime: '06:30 PM' },
  ],
  '2026-06-25': [
    { inTime: '09:30 AM', outTime: '06:00 PM' },
  ],
  '2026-06-26': [
    { inTime: '09:10 AM', outTime: '05:45 PM' },
  ],
  '2026-06-15': [{ inTime: '09:05 AM', outTime: '06:20 PM' }],
  '2026-06-16': [
    { inTime: '10:15 AM', outTime: '01:00 PM' },
    { inTime: '01:45 PM', outTime: '07:10 PM' },
  ],
  '2026-06-17': [{ inTime: '09:00 AM', outTime: '05:45 PM' }],
  '2026-06-18': [{ inTime: '09:10 AM', outTime: '06:00 PM' }],
  '2026-06-19': [{ inTime: '09:20 AM', outTime: '06:15 PM' }],
};

function buildEntry(date: Date): DayEntry {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return { date, sessions: [], totalMins: 0, firstIn: '', lastOut: null, status: 'ON TIME', type: 'weekend' };
  }
  const sessions = SESSION_MAP[dk(date)] ?? [];
  const totalMins = sessions.reduce((sum, s) => {
    if (!s.outTime) return sum;
    return sum + timeToMins(s.outTime) - timeToMins(s.inTime);
  }, 0);
  const firstIn  = sessions[0]?.inTime ?? '';
  const lastOut  = sessions[sessions.length - 1]?.outTime ?? null;
  const isLate   = sessions.length > 0 && timeToMins(sessions[0].inTime) > timeToMins('09:30 AM');
  return {
    date, sessions, totalMins,
    firstIn, lastOut,
    status: isLate ? 'LATE' : 'ON TIME',
    type: 'office',
  };
}

/* ── Mock regularization data ── */
const INITIAL_REG: RegRequest[] = [
  {
    id: '1', dateStr: '17 Jun 2026',
    inTime: '09:00 AM', outTime: '06:00 PM',
    reason: 'Forgot to punch out after field visit',
    status: 'Approved',
  },
  {
    id: '2', dateStr: '10 Jun 2026',
    inTime: '09:00 AM', outTime: '07:30 PM',
    reason: 'System glitch — attendance not recorded',
    status: 'Pending',
  },
  {
    id: '3', dateStr: '05 Jun 2026',
    inTime: '09:15 AM', outTime: '06:15 PM',
    reason: 'Biometric machine not working',
    status: 'Rejected',
  },
];

/* ════════════════════════════════════════════════════════ */
export default function AttendanceScreen({ navigation }: any) {
  const today = new Date();
  const [activeTab, setActiveTab] = useState<'attendance' | 'regularization'>('attendance');
  const [viewMode, setViewMode]   = useState<'weekly' | 'monthly' | 'quarterly'>('weekly');
  const [wkStart, setWkStart]     = useState(() => getWeekStart(today));
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [regList, setRegList]     = useState<RegRequest[]>(INITIAL_REG);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ dateStr: '', inTime: '', outTime: '', reason: '' });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(wkStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [wkStart],
  );

  const entries     = useMemo(() => weekDays.map(buildEntry), [weekDays]);
  const weekEnd     = weekDays[6];
  const officeDays  = entries.filter(e => e.type === 'office' && e.sessions.length > 0).length;
  const wfhDays     = entries.filter(e => e.type === 'wfh').length;
  const leaveDays   = entries.filter(e => e.type === 'leave').length;
  const totalWkMins = entries.reduce((sum, e) => sum + e.totalMins, 0);

  function toggleDay(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function submitReg() {
    if (!form.dateStr || !form.inTime || !form.outTime || !form.reason.trim()) return;
    const newReq: RegRequest = {
      id: String(Date.now()),
      dateStr: form.dateStr,
      inTime: form.inTime,
      outTime: form.outTime,
      reason: form.reason,
      status: 'Pending',
    };
    setRegList(prev => [newReq, ...prev]);
    setForm({ dateStr: '', inTime: '', outTime: '', reason: '' });
    setShowModal(false);
  }

  /* ── Render ── */
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
          <Text style={s.headerTitle}>Timesheet</Text>
        </View>
        <View style={s.headerIcons}>
          <TouchableOpacity style={s.bellWrap} onPress={() => navigation?.navigate('Notifications')}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
            <View style={s.bellDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Sub-tabs ── */}
      <View style={s.tabBar}>
        {(['attendance', 'regularization'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tabItem, activeTab === tab && s.tabItemActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'attendance' ? 'Attendance' : 'Regularization'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Attendance Tab ── */}
      {activeTab === 'attendance' && (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

          {/* View mode pills */}
          <View style={s.pillsWrap}>
            {(['weekly', 'monthly', 'quarterly'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[s.pill, viewMode === mode && s.pillActive]}
                onPress={() => setViewMode(mode)}
              >
                <Text style={[s.pillText, viewMode === mode && s.pillTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Week navigator */}
          <View style={s.weekNav}>
            <TouchableOpacity
              onPress={() => setWkStart(d => addWeeks(d, -1))}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={s.navArrow}>‹</Text>
            </TouchableOpacity>
            <View style={s.navCenter}>
              <Text style={{ fontSize: 14 }}>📅</Text>
              <Text style={s.navLabel}>{rangeLabel(wkStart, weekEnd)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setWkStart(d => addWeeks(d, 1))}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={s.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Summary chips */}
          <View style={s.summaryRow}>
            <View style={s.summaryChip}>
              <View style={[s.dot, { backgroundColor: '#4F46E5' }]} />
              <Text style={s.chipText}>Office: {officeDays}</Text>
            </View>
            <View style={s.summaryChip}>
              <View style={[s.dot, { backgroundColor: '#10B981' }]} />
              <Text style={s.chipText}>WFH: {wfhDays}</Text>
            </View>
            <View style={s.summaryChip}>
              <View style={[s.dot, { backgroundColor: '#EF4444' }]} />
              <Text style={s.chipText}>Leave: {leaveDays}</Text>
            </View>
          </View>

          {/* Total hours this week */}
          <View style={s.totalCard}>
            <View style={s.totalLeft}>
              <Text style={{ fontSize: 28 }}>⏱</Text>
              <View>
                <Text style={s.totalLabel}>Total hours this week</Text>
                <Text style={s.totalValue}>{totalWkMins > 0 ? minsToHM(totalWkMins) : '—'}</Text>
              </View>
            </View>
            <View style={s.totalRight}>
              <Text style={s.totalTarget}>Target 40h</Text>
              <View style={s.pctBadge}>
                <Text style={s.pctText}>
                  {totalWkMins > 0 ? `${Math.min(100, Math.round(totalWkMins / 2400 * 100))}%` : '0%'}
                </Text>
              </View>
            </View>
          </View>

          {/* Policy banner */}
          <View style={s.policyBanner}>
            <Text style={{ fontSize: 14 }}>ℹ️</Text>
            <Text style={s.policyText}>
              Full-time Work from Office policy applies to your current work week.
            </Text>
          </View>

          {/* Day entries */}
          {entries.map((entry, idx) => {
            /* Weekend divider — render once for Saturday */
            if (entry.type === 'weekend' && entry.date.getDay() === 6) {
              const sun = entries[idx + 1];
              const mo  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              return (
                <View key={dk(entry.date)} style={s.weekendRow}>
                  <View style={s.weekendLine} />
                  <View style={s.weekendChip}>
                    <Text style={{ fontSize: 11 }}>📅</Text>
                    <Text style={s.weekendText}>
                      Weekend ({entry.date.getDate()} – {sun?.date.getDate()} {mo[entry.date.getMonth()]})
                    </Text>
                  </View>
                  <View style={s.weekendLine} />
                </View>
              );
            }
            if (entry.type === 'weekend' || entry.sessions.length === 0) return null;

            const key        = dk(entry.date);
            const isExpanded = expanded.has(key);

            return (
              <TouchableOpacity
                key={key}
                style={s.dayCard}
                onPress={() => toggleDay(key)}
                activeOpacity={0.85}
              >
                {/* Date + status */}
                <View style={s.dayHeader}>
                  <Text style={s.dayDate}>{dayLabel(entry.date)}</Text>
                  <View style={[
                    s.statusBadge,
                    entry.status === 'LATE' && s.statusLate,
                    entry.status === 'WFH'  && s.statusWfh,
                  ]}>
                    <Text style={[
                      s.statusText,
                      entry.status === 'LATE' && s.statusTextLate,
                      entry.status === 'WFH'  && s.statusTextWfh,
                    ]}>
                      {entry.status}
                    </Text>
                  </View>
                </View>

                {/* First IN → Last OUT + total */}
                <View style={s.timeRow}>
                  <Text style={s.timeIn}>{entry.firstIn}</Text>
                  <View style={s.arrow}>
                    <View style={s.arrowLine} />
                    <Text style={s.arrowHead}>→</Text>
                  </View>
                  <Text style={s.timeOut}>{entry.lastOut ?? '—'}</Text>
                  <View style={s.totalBadge}>
                    <Text style={s.totalBadgeText}>{minsToHM(entry.totalMins)}</Text>
                  </View>
                </View>

                {/* Expanded sessions */}
                {isExpanded && (
                  <View style={s.sessionsWrap}>
                    <View style={s.sectionDiv} />
                    <Text style={s.sessionsHeader}>ALL SESSIONS ({entry.sessions.length})</Text>
                    {entry.sessions.map((sess, si) => {
                      const dur     = sess.outTime ? timeToMins(sess.outTime) - timeToMins(sess.inTime) : null;
                      const isFirst = si === 0;
                      const isLast  = si === entry.sessions.length - 1;
                      return (
                        <View key={si} style={s.sessionItem}>
                          <View style={s.connectorWrap}>
                            <View style={[s.connDot, isFirst && s.connDotFirst, isLast && s.connDotLast]} />
                            {!isLast && <View style={s.connLine} />}
                          </View>
                          <View style={s.sessionBody}>
                            <View style={s.sessionMeta}>
                              <Text style={s.sessionLabel}>
                                {isFirst ? 'First In' : isLast ? 'Last Out' : `Session ${si + 1}`}
                              </Text>
                              {dur !== null && (
                                <Text style={s.sessionDur}>{minsToHM(dur)}</Text>
                              )}
                            </View>
                            <View style={s.sessionTimesRow}>
                              <Text style={s.sIn}>{sess.inTime}</Text>
                              <Text style={s.sArrow}> → </Text>
                              <Text style={[s.sOut, !sess.outTime && s.sOutActive]}>
                                {sess.outTime ?? 'Still In'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Expand / collapse hint */}
                <View style={s.expandHint}>
                  <View style={s.expandLine} />
                  <Text style={s.expandText}>
                    {isExpanded
                      ? '▲  hide'
                      : `▼  ${entry.sessions.length} session${entry.sessions.length > 1 ? 's' : ''}`}
                  </Text>
                  <View style={s.expandLine} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Regularization Tab ── */}
      {activeTab === 'regularization' && (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={s.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {regList.length === 0 && (
              <View style={s.emptyWrap}>
                <Text style={{ fontSize: 36 }}>📋</Text>
                <Text style={s.emptyText}>No regularization requests yet</Text>
              </View>
            )}
            {regList.map(req => (
              <View key={req.id} style={s.regCard}>
                <View style={s.regHeader}>
                  <View>
                    <Text style={s.regDate}>{req.dateStr}</Text>
                    <View style={s.regTimes}>
                      <Text style={s.regTime}>{req.inTime}</Text>
                      <Text style={s.regSep}> → </Text>
                      <Text style={s.regTime}>{req.outTime}</Text>
                    </View>
                  </View>
                  <View style={[
                    s.regBadge,
                    req.status === 'Approved' && s.regBadgeApproved,
                    req.status === 'Rejected' && s.regBadgeRejected,
                  ]}>
                    <Text style={[
                      s.regBadgeText,
                      req.status === 'Approved' && s.regBadgeTextApproved,
                      req.status === 'Rejected' && s.regBadgeTextRejected,
                    ]}>
                      {req.status}
                    </Text>
                  </View>
                </View>
                <Text style={s.regReason} numberOfLines={2}>{req.reason}</Text>
              </View>
            ))}
          </ScrollView>

          {/* FAB */}
          <View style={s.fabWrap}>
            <TouchableOpacity style={s.fab} onPress={() => setShowModal(true)}>
              <Text style={s.fabText}>+ New Regularization Request</Text>
            </TouchableOpacity>
          </View>

          {/* New Regularization Modal */}
          <Modal visible={showModal} transparent animationType="slide">
            <TouchableOpacity
              style={s.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowModal(false)}
            >
              <View style={s.modalSheet}>
                <View style={s.sheetHandle} />
                <Text style={s.sheetTitle}>New Regularization</Text>

                <Text style={s.modalLabel}>Date (e.g. 27 Jun 2026)</Text>
                <TextInput
                  style={s.modalInput}
                  placeholder="27 Jun 2026"
                  placeholderTextColor="#9CA3AF"
                  value={form.dateStr}
                  onChangeText={v => setForm(f => ({ ...f, dateStr: v }))}
                />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalLabel}>In Time</Text>
                    <TextInput
                      style={s.modalInput}
                      placeholder="09:00 AM"
                      placeholderTextColor="#9CA3AF"
                      value={form.inTime}
                      onChangeText={v => setForm(f => ({ ...f, inTime: v }))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalLabel}>Out Time</Text>
                    <TextInput
                      style={s.modalInput}
                      placeholder="06:00 PM"
                      placeholderTextColor="#9CA3AF"
                      value={form.outTime}
                      onChangeText={v => setForm(f => ({ ...f, outTime: v }))}
                    />
                  </View>
                </View>

                <Text style={s.modalLabel}>Reason</Text>
                <TextInput
                  style={[s.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder="Explain why regularization is needed..."
                  placeholderTextColor="#9CA3AF"
                  value={form.reason}
                  onChangeText={v => setForm(f => ({ ...f, reason: v }))}
                  multiline
                />

                <TouchableOpacity
                  style={[
                    s.submitBtn,
                    (!form.dateStr || !form.inTime || !form.outTime || !form.reason.trim()) && s.submitBtnOff,
                  ]}
                  onPress={submitReg}
                >
                  <Text style={s.submitText}>Submit Request</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  /* header */
  header: {
    backgroundColor: '#1E1B4B',
    paddingTop: 48, paddingBottom: 14, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  headerBack: { fontSize: 26, color: '#FFF', fontWeight: '600' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute', top: 5, right: 5,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444',
    borderWidth: 1.5, borderColor: '#1E1B4B',
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 12 },

  /* sub-tabs */
  tabBar: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    elevation: 2,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 13,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#4F46E5' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#9CA3AF' },
  tabTextActive: { color: '#4F46E5', fontWeight: '700' },

  scroll: { flex: 1 },

  /* view pills */
  pillsWrap: {
    flexDirection: 'row', margin: 16, marginBottom: 10,
    backgroundColor: '#FFF', borderRadius: 12, padding: 4,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  pill:          { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  pillActive:    { backgroundColor: '#4F46E5' },
  pillText:      { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  pillTextActive:{ color: '#FFF', fontWeight: '700' },

  /* week nav */
  weekNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  navArrow: { fontSize: 26, color: '#1F2937', fontWeight: '600', paddingHorizontal: 4 },
  navCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navLabel:  { fontSize: 15, fontWeight: '600', color: '#1F2937' },

  /* summary chips */
  summaryRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, gap: 8 },
  summaryChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFF', borderRadius: 10, padding: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3,
  },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '600' },

  /* total hours card */
  totalCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#1E1B4B', borderRadius: 16, padding: 16,
    elevation: 4,
  },
  totalLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  totalLabel: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  totalValue: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  totalRight: { alignItems: 'flex-end', gap: 6 },
  totalTarget:{ fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  pctBadge:   { backgroundColor: 'rgba(165,243,252,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  pctText:    { fontSize: 18, fontWeight: '800', color: '#A5F3FC' },

  /* policy banner */
  policyBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#10B981',
  },
  policyText: { flex: 1, fontSize: 12, color: '#065F46', lineHeight: 18, fontWeight: '500' },

  /* weekend divider */
  weekendRow:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8 },
  weekendLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  weekendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F9FAFB', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  weekendText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  /* day card */
  dayCard: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
  },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  dayDate: { fontSize: 14, fontWeight: '700', color: '#1F2937' },

  statusBadge:     { backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusLate:      { backgroundColor: '#FEF3C7' },
  statusWfh:       { backgroundColor: '#DBEAFE' },
  statusText:      { fontSize: 10, fontWeight: '700', color: '#065F46', letterSpacing: 0.5 },
  statusTextLate:  { color: '#92400E' },
  statusTextWfh:   { color: '#1D4ED8' },

  /* time row */
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  timeIn:  { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  arrow:   { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  arrowLine: { flex: 1, height: 1, backgroundColor: '#D1D5DB' },
  arrowHead: { fontSize: 13, color: '#9CA3AF', marginLeft: 2 },
  timeOut:        { fontSize: 15, fontWeight: '700', color: '#1F2937', marginRight: 10 },
  totalBadge:     { backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  totalBadgeText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },

  /* sessions */
  sessionsWrap:   { marginTop: 10 },
  sectionDiv:     { height: 1, backgroundColor: '#F3F4F6', marginBottom: 10 },
  sessionsHeader: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 10 },

  sessionItem: { flexDirection: 'row', marginBottom: 12 },
  connectorWrap: { width: 22, alignItems: 'center', marginRight: 10, paddingTop: 2 },
  connDot:      { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#9CA3AF', backgroundColor: '#F3F4F6' },
  connDotFirst: { borderColor: '#10B981', backgroundColor: '#D1FAE5' },
  connDotLast:  { borderColor: '#EF4444', backgroundColor: '#FEE2E2' },
  connLine:     { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginTop: 2 },
  sessionBody:  { flex: 1 },
  sessionMeta:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  sessionLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  sessionDur:   {
    fontSize: 11, fontWeight: '700', color: '#4F46E5',
    backgroundColor: '#EDE9FE', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  sessionTimesRow: { flexDirection: 'row', alignItems: 'center' },
  sIn:    { fontSize: 13, fontWeight: '700', color: '#10B981' },
  sArrow: { fontSize: 12, color: '#9CA3AF' },
  sOut:   { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  sOutActive: { color: '#F59E0B' },

  /* expand hint */
  expandHint: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  expandLine: { flex: 1, height: 1, backgroundColor: '#F3F4F6' },
  expandText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  /* regularization */
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

  regCard: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 10, marginTop: 6,
    borderRadius: 14, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
  },
  regHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  regDate:   { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  regTimes:  { flexDirection: 'row', alignItems: 'center' },
  regTime:   { fontSize: 13, fontWeight: '600', color: '#374151' },
  regSep:    { color: '#9CA3AF', fontSize: 13 },

  regBadge:              { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  regBadgeApproved:      { backgroundColor: '#D1FAE5' },
  regBadgeRejected:      { backgroundColor: '#FEE2E2' },
  regBadgeText:          { fontSize: 11, fontWeight: '700', color: '#92400E' },
  regBadgeTextApproved:  { color: '#065F46' },
  regBadgeTextRejected:  { color: '#991B1B' },
  regReason:             { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  /* FAB */
  fabWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: '#F3F4F6',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  fab:     { backgroundColor: '#4F46E5', borderRadius: 14, padding: 16, alignItems: 'center', elevation: 4 },
  fabText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  /* modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingTop: 16,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  modalLabel:  { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  modalInput:  {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#1F2937',
    backgroundColor: '#FAFAFA', marginBottom: 14,
  },
  submitBtn:    { backgroundColor: '#4F46E5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  submitBtnOff: { backgroundColor: '#C4C4DE', opacity: 0.7 },
  submitText:   { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
