import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchNotifications } from '../../store/slices/notificationsSlice';
import { fetchApprovals } from '../../store/slices/approvalsSlice';
import { useLivePolling } from '../../utils/useLivePolling';
import {
  T, TEAM, PRESENCE_META, KIND_META, TINT, initialsOf, avatarColor,
} from '../../data/managerData';
import GoalsSection from '../projects/GoalsSection';
import Icon from '../../components/Icon';
import { announcementApi, holidayApi } from '../../services/api';

const { width } = Dimensions.get('window');

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
const headerDate = new Date()
  .toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  .toUpperCase();

export default function ManagerDashboardScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);
  const approvals = useSelector((s: RootState) => s.approvals.items);
  const unread = useSelector((s: RootState) => s.notifications.items.filter((i) => !i.read).length);

  // Refetch on focus, then keep polling every 15s while this tab stays open -
  // so a leave/ticket submitted elsewhere shows up while the manager is
  // sitting right here, not only after they navigate away and back.
  useLivePolling(
    useCallback(() => {
      dispatch(fetchNotifications());
      dispatch(fetchApprovals());
    }, [dispatch]),
  );

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [nextHoliday, setNextHoliday] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await announcementApi.list();
        if (Array.isArray(data)) {
          const sorted = [...data].sort((a, b) => {
            if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          setAnnouncements(sorted);
        }
      } catch { /* offline */ }
      try {
        const { data } = await holidayApi.list();
        if (Array.isArray(data)) {
          const t = new Date(); t.setHours(0, 0, 0, 0);
          const future = data
            .filter((h: any) => { const [y, m, d] = (h.date || '').split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1).getTime() >= t.getTime(); })
            .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
          setNextHoliday(future[0] || null);
        }
      } catch { /* offline */ }
    })();
  }, []);

  const name = (user?.email?.split('@')[0] || 'Manager').replace(/\./g, ' ');
  const initials = initialsOf(name);

  const pending = approvals.filter((a) => a.status === 'pending');
  const inCount     = TEAM.filter((m) => m.presence === 'in').length;
  const remoteCount = TEAM.filter((m) => m.presence === 'remote').length;
  const leaveCount  = TEAM.filter((m) => m.presence === 'leave').length;
  const outCount    = TEAM.filter((m) => m.presence === 'out').length;
  const presentPct  = Math.round(((inCount + remoteCount) / TEAM.length) * 100);
  const avgAtt      = Math.round(TEAM.reduce((a, m) => a + m.attendancePct, 0) / TEAM.length);

  // group pending counts by kind for the summary chips
  const byKind = pending.reduce<Record<string, number>>((acc, a) => {
    acc[a.kind] = (acc[a.kind] || 0) + 1; return acc;
  }, {});

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      {/* ── Header ── */}
      <View style={st.header}>
        <View style={st.headerTop}>
          <View>
            <Text style={st.hDate}>{headerDate}</Text>
            <Text style={st.hGreet}>{greeting()} 👋</Text>
            <Text style={st.hName}>{name}</Text>
          </View>
          <View style={st.headerRight}>
            <TouchableOpacity style={st.bell} onPress={() => navigation?.navigate('Notifications')}>
              <Icon name="bell" size={18} color="#FFFFFF" />
              {unread > 0 && <View style={st.bellDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={[st.avatar, { backgroundColor: T.primary }]} onPress={() => navigation?.navigate('Profile')} activeOpacity={0.8}>
              <Text style={st.avatarTx}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={st.body} contentContainerStyle={st.bodyC} showsVerticalScrollIndicator={false}>
        {/* ── Team pulse ── */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <Text style={st.cardTitle}>Team Pulse · Today</Text>
            <View style={st.livePill}><View style={st.liveDot} /><Text style={st.liveTx}>LIVE</Text></View>
          </View>

          <View style={st.pulseRow}>
            <View style={st.pulseBig}>
              <Text style={st.pulseBigNum}>{presentPct}%</Text>
              <Text style={st.pulseBigLabel}>present</Text>
              <View style={st.barTrack}>
                <View style={[st.barFill, { width: `${presentPct}%` }]} />
              </View>
            </View>
            <View style={st.pulseGrid}>
              {[
                { n: inCount,     l: 'In office', c: PRESENCE_META.in.dot },
                { n: remoteCount, l: 'Remote',    c: PRESENCE_META.remote.dot },
                { n: leaveCount,  l: 'On leave',  c: PRESENCE_META.leave.dot },
                { n: outCount,    l: 'Not in',    c: PRESENCE_META.out.dot },
              ].map((x) => (
                <View key={x.l} style={st.pulseCell}>
                  <View style={[st.pulseCellDot, { backgroundColor: x.c }]} />
                  <Text style={st.pulseCellNum}>{x.n}</Text>
                  <Text style={st.pulseCellLabel}>{x.l}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Pending approvals summary ── */}
        <View style={st.section}>
          <View style={st.sectionHead}>
            <Text style={st.sectionTitle}>PENDING APPROVALS</Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Approvals')}>
              <Text style={st.seeAll}>Open inbox ›</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.9} style={st.approvalsCard} onPress={() => navigation?.navigate('Approvals')}>
            <View style={st.approvalsLeft}>
              <Text style={st.approvalsBig}>{pending.length}</Text>
              <Text style={st.approvalsBigLabel}>awaiting{'\n'}your action</Text>
            </View>
            <View style={st.approvalsDivider} />
            <View style={st.approvalsKinds}>
              {(Object.keys(KIND_META) as (keyof typeof KIND_META)[]).map((k) => {
                const meta = KIND_META[k];
                const tint = TINT[meta.tint];
                return (
                  <View key={k} style={st.kindRow}>
                    <View style={[st.kindIcon, { backgroundColor: tint.bg }]}>
                      <Text style={{ fontSize: 13 }}>{meta.icon}</Text>
                    </View>
                    <Text style={st.kindLabel}>{meta.label}</Text>
                    <Text style={[st.kindCount, { color: byKind[k] ? tint.fg : T.faint }]}>{byKind[k] || 0}</Text>
                  </View>
                );
              })}
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Announcements ── */}
        <View style={st.section}>
          <View style={st.sectionHead}>
            <Text style={st.sectionTitle}>ANNOUNCEMENTS</Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Announcements')}>
              <Text style={st.seeAll}>See all ›</Text>
            </TouchableOpacity>
          </View>
          <View style={st.card}>
            {announcements.length === 0 ? (
              <Text style={st.annEmpty}>No announcements right now.</Text>
            ) : (
              announcements.slice(0, 2).map((a, i, arr) => (
                <TouchableOpacity
                  key={a.id}
                  activeOpacity={0.8}
                  onPress={() => navigation?.navigate('Announcements')}
                  style={[st.annRow, i < arr.length - 1 && st.annDivider]}
                >
                  <Text style={st.annPin}>{a.pinned ? '📌' : '📣'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.annTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={st.annBody} numberOfLines={1}>{a.body}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* ── Upcoming Holiday ── */}
        {nextHoliday && (() => {
          const [y, m, d] = String(nextHoliday.date).split('-').map(Number);
          const hd = new Date(y, (m || 1) - 1, d || 1);
          return (
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigation?.navigate('Holidays')} style={st.holidayCard}>
              <View style={st.holidayChip}>
                <Text style={st.holidayChipDay}>{hd.getDate()}</Text>
                <Text style={st.holidayChipMon}>{hd.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.holidayLabel}>UPCOMING HOLIDAY</Text>
                <Text style={st.holidayName} numberOfLines={1}>{nextHoliday.name}</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          );
        })()}

        {/* ── KPI strip ── */}
        <View style={st.kpiRow}>
          {[
            { v: `${TEAM.length}`, l: 'Team size', e: '👥', bg: '#EEF2FF' },
            { v: `${avgAtt}%`,     l: 'Avg attendance', e: '📊', bg: '#ECFDF5' },
            { v: `${TEAM.reduce((a, m) => a + m.pending, 0)}`, l: 'Open requests', e: '🗂️', bg: '#FFF7ED' },
          ].map((k) => (
            <View key={k.l} style={[st.kpiCard, { backgroundColor: k.bg }]}>
              <Text style={st.kpiEmoji}>{k.e}</Text>
              <Text style={st.kpiVal}>{k.v}</Text>
              <Text style={st.kpiLabel}>{k.l}</Text>
            </View>
          ))}
        </View>

        {/* ── Goals (project boards) ── */}
        <GoalsSection navigation={navigation} />

        {/* ── Quick actions ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>QUICK ACTIONS</Text>
          <View style={st.quickRow}>
            {[
              { e: '✅', l: 'Approvals', go: 'Approvals' },
              { e: '👥', l: 'My Team',  go: 'Team' },
              { e: '📈', l: 'Insights',  go: 'Insights' },
            ].map((q) => (
              <TouchableOpacity key={q.l} style={st.quickChip} activeOpacity={0.85} onPress={() => navigation?.navigate(q.go)}>
                <Text style={st.quickEmoji}>{q.e}</Text>
                <Text style={st.quickLabel}>{q.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── My workspace (self-service — no view switching needed) ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>MY WORKSPACE</Text>
          <View style={st.quickRow}>
            {[
              { e: '🏖️', l: 'Apply Leave',  go: 'ApplyLeave' },
              { e: '🎫', l: 'Raise Ticket', go: 'RaiseTicket' },
              { e: '💰', l: 'Payslip',      go: 'Payroll' },
              { e: '🕒', l: 'Timesheet',    go: 'Timesheet' },
              { e: '📝', l: 'Request',      go: 'CreateRequest' },
            ].map((q) => (
              <TouchableOpacity key={q.l} style={st.quickChip} activeOpacity={0.85} onPress={() => navigation?.navigate(q.go)}>
                <Text style={st.quickEmoji}>{q.e}</Text>
                <Text style={st.quickLabelSm}>{q.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── On leave / out today ── */}
        <View style={[st.section, { marginBottom: 8 }]}>
          <Text style={st.sectionTitle}>AWAY TODAY</Text>
          <View style={st.card}>
            {TEAM.filter((m) => m.presence === 'leave' || m.presence === 'out').map((m, i, arr) => (
              <TouchableOpacity
                key={m.id}
                style={[st.awayRow, i < arr.length - 1 && st.awayDivider]}
                onPress={() => navigation?.navigate('TeamMember', { member: m })}
              >
                <View style={[st.awayAvatar, { backgroundColor: avatarColor(m.name) }]}>
                  <Text style={st.awayAvatarTx}>{initialsOf(m.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.awayName}>{m.name}</Text>
                  <Text style={st.awayDesig}>{m.designation}</Text>
                </View>
                <View style={[st.awayChip, { backgroundColor: PRESENCE_META[m.presence].chipBg }]}>
                  <Text style={[st.awayChipTx, { color: PRESENCE_META[m.presence].chipFg }]}>
                    {PRESENCE_META[m.presence].label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {TEAM.filter((m) => m.presence === 'leave' || m.presence === 'out').length === 0 && (
              <Text style={st.awayEmpty}>Everyone is in today 🎉</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 18, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hDate: { fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8, fontWeight: '500' },
  hGreet: { fontSize: 22, fontWeight: '700', color: '#FFF', marginTop: 2 },
  hName: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2, textTransform: 'capitalize' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: T.header },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarTx: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  switchPill: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  switchTx: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  switchAction: { color: '#C7D2FE', fontWeight: '600', fontSize: 12 },

  body: { flex: 1 },
  bodyC: { padding: 16, paddingBottom: 28 },

  card: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: T.ink },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveTx: { fontSize: 9, fontWeight: '800', color: '#991B1B', letterSpacing: 0.5 },

  pulseRow: { flexDirection: 'row', gap: 16 },
  pulseBig: { width: width * 0.30, alignItems: 'center', justifyContent: 'center' },
  pulseBigNum: { fontSize: 34, fontWeight: '800', color: T.primary },
  pulseBigLabel: { fontSize: 12, color: T.sub, marginTop: -2, marginBottom: 8 },
  barTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#EEF2FF', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: T.primary },
  pulseGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pulseCell: { width: '45%', flexDirection: 'row', alignItems: 'center', gap: 6 },
  pulseCellDot: { width: 8, height: 8, borderRadius: 4 },
  pulseCellNum: { fontSize: 16, fontWeight: '800', color: T.ink },
  pulseCellLabel: { fontSize: 11, color: T.sub },

  section: { marginBottom: 16 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.8, marginBottom: 12 },
  seeAll: { fontSize: 12, color: T.primary, fontWeight: '600' },

  approvalsCard: { flexDirection: 'row', backgroundColor: T.card, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  approvalsLeft: { width: 92, alignItems: 'center', justifyContent: 'center' },
  approvalsBig: { fontSize: 40, fontWeight: '800', color: T.primary },
  approvalsBigLabel: { fontSize: 11, color: T.sub, textAlign: 'center', marginTop: -2 },
  approvalsDivider: { width: 1, backgroundColor: T.line, marginHorizontal: 14 },
  approvalsKinds: { flex: 1, gap: 9 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kindLabel: { flex: 1, fontSize: 13, color: T.ink, fontWeight: '500' },
  kindCount: { fontSize: 14, fontWeight: '800' },

  annRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  annDivider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  annPin: { fontSize: 16 },
  annTitle: { fontSize: 14, fontWeight: '700', color: T.ink },
  annBody: { fontSize: 12, color: T.sub, marginTop: 1 },
  annEmpty: { fontSize: 13, color: T.faint, paddingVertical: 8, textAlign: 'center' },
  holidayCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 16, padding: 14, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  holidayChip: { width: 46, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: T.primary, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  holidayChipDay: { fontSize: 18, fontWeight: '800', color: T.primary },
  holidayChipMon: { fontSize: 9.5, fontWeight: '700', color: T.primary, letterSpacing: 0.5 },
  holidayLabel: { fontSize: 10.5, fontWeight: '700', color: T.faint, letterSpacing: 0.8 },
  holidayName: { fontSize: 15, fontWeight: '700', color: T.ink, marginTop: 2 },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'flex-start' },
  kpiEmoji: { fontSize: 18, marginBottom: 6 },
  kpiVal: { fontSize: 20, fontWeight: '800', color: T.ink },
  kpiLabel: { fontSize: 10.5, color: T.sub, marginTop: 2 },

  quickRow: { flexDirection: 'row', gap: 10 },
  quickChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.card, borderRadius: 12, paddingVertical: 14, gap: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  quickEmoji: { fontSize: 16 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  quickLabelSm: { fontSize: 10.5, fontWeight: '600', color: '#374151', textAlign: 'center' },

  awayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  awayDivider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  awayAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  awayAvatarTx: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  awayName: { fontSize: 14, fontWeight: '600', color: T.ink },
  awayDesig: { fontSize: 12, color: T.sub, marginTop: 1 },
  awayChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  awayChipTx: { fontSize: 10.5, fontWeight: '700' },
  awayEmpty: { textAlign: 'center', color: T.sub, fontSize: 13, paddingVertical: 10 },
});
