import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchNotifications } from '../../store/slices/notificationsSlice';
import { fetchHRRequests } from '../../store/slices/hrRequestsSlice';
import { useLivePolling } from '../../utils/useLivePolling';
import { announcementApi, holidayApi } from '../../services/api';
import { initialsOf, avatarColor, PRESENCE_META } from '../../data/managerData';
import GoalsSection from '../projects/GoalsSection';
import {
  T, HR_PEOPLE, HR_KIND_META, TINT, NEW_JOINERS, CELEBRATIONS,
} from '../../data/hrData';
import Icon from '../../components/Icon';

const { width } = Dimensions.get('window');

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
const headerDate = new Date()
  .toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  .toUpperCase();

export default function HRDashboardScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);
  const requests = useSelector((s: RootState) => s.hrRequests.items);
  const unread = useSelector((s: RootState) => s.notifications.items.filter((i) => !i.read).length);

  // Refetch on focus, then keep polling every 15s while HR stays on this tab -
  // so a request submitted elsewhere shows up while they're looking.
  useLivePolling(
    useCallback(() => {
      dispatch(fetchNotifications());
      dispatch(fetchHRRequests());
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

  const name = (user?.email?.split('@')[0] || 'HR').replace(/\./g, ' ');
  const pending = requests.filter((r) => r.status === 'pending');

  const present = HR_PEOPLE.filter((p) => p.presence === 'in' || p.presence === 'remote').length;
  const onLeave = HR_PEOPLE.filter((p) => p.presence === 'leave').length;
  const presentPct = Math.round((present / HR_PEOPLE.length) * 100);
  const depts = new Set(HR_PEOPLE.map((p) => p.department)).size;

  const byKind = pending.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] || 0) + 1; return acc;
  }, {});

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      <View style={st.header}>
        <View style={st.headerTop}>
          <View>
            <Text style={st.hDate}>{headerDate}</Text>
            <Text style={st.hGreet}>{greeting()} 👋</Text>
            <Text style={st.hName}>{name} · People Team</Text>
          </View>
          <View style={st.headerRight}>
            <TouchableOpacity style={st.bell} onPress={() => navigation?.navigate('Notifications')}>
              <Icon name="bell" size={18} color="#FFFFFF" />
              {unread > 0 && <View style={st.bellDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={[st.avatar, { backgroundColor: T.primary }]} onPress={() => navigation?.navigate('Profile')} activeOpacity={0.8}>
              <Text style={st.avatarTx}>{initialsOf(name)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={st.body} contentContainerStyle={st.bodyC} showsVerticalScrollIndicator={false}>
        {/* org pulse */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <Text style={st.cardTitle}>Organization · Today</Text>
            <View style={st.livePill}><View style={st.liveDot} /><Text style={st.liveTx}>LIVE</Text></View>
          </View>
          <View style={st.pulseRow}>
            <View style={st.pulseBig}>
              <Text style={st.pulseBigNum}>{presentPct}%</Text>
              <Text style={st.pulseBigLabel}>present</Text>
              <View style={st.barTrack}><View style={[st.barFill, { width: `${presentPct}%` }]} /></View>
            </View>
            <View style={st.pulseGrid}>
              {[
                { n: HR_PEOPLE.length, l: 'Headcount', c: T.primary },
                { n: present,          l: 'Available', c: PRESENCE_META.in.dot },
                { n: onLeave,          l: 'On leave',  c: PRESENCE_META.leave.dot },
                { n: depts,            l: 'Departments', c: PRESENCE_META.remote.dot },
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

        {/* pending HR requests */}
        <View style={st.section}>
          <View style={st.sectionHead}>
            <Text style={st.sectionTitle}>PENDING REQUESTS</Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Requests')}>
              <Text style={st.seeAll}>Open inbox ›</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={0.9} style={st.reqCard} onPress={() => navigation?.navigate('Requests')}>
            <View style={st.reqLeft}>
              <Text style={st.reqBig}>{pending.length}</Text>
              <Text style={st.reqBigLabel}>awaiting{'\n'}your action</Text>
            </View>
            <View style={st.reqDivider} />
            <View style={st.reqKinds}>
              {(Object.keys(HR_KIND_META) as (keyof typeof HR_KIND_META)[]).map((k) => {
                const meta = HR_KIND_META[k]; const tint = TINT[meta.tint];
                return (
                  <View key={k} style={st.kindRow}>
                    <View style={[st.kindIcon, { backgroundColor: tint.bg }]}><Text style={{ fontSize: 13 }}>{meta.icon}</Text></View>
                    <Text style={st.kindLabel}>{meta.label}</Text>
                    <Text style={[st.kindCount, { color: byKind[k] ? tint.fg : T.faint }]}>{byKind[k] || 0}</Text>
                  </View>
                );
              })}
            </View>
          </TouchableOpacity>
        </View>

        {/* announcements */}
        <View style={st.section}>
          <View style={st.sectionHead}>
            <Text style={st.sectionTitle}>ANNOUNCEMENTS</Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Announcements')}>
              <Text style={st.seeAll}>See all ›</Text>
            </TouchableOpacity>
          </View>
          <View style={st.card}>
            {announcements.length === 0 ? (
              <Text style={st.annEmpty}>No announcements yet. Post one from the Announcements screen.</Text>
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

        {/* upcoming holiday */}
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

        {/* goals (project boards) */}
        <GoalsSection navigation={navigation} />

        {/* quick actions */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>QUICK ACTIONS</Text>
          <View style={st.quickRow}>
            {[
              { e: '📨', l: 'Requests', go: 'Requests' },
              { e: '👥', l: 'People',   go: 'People' },
              { e: '📊', l: 'Insights', go: 'Insights' },
            ].map((q) => (
              <TouchableOpacity key={q.l} style={st.quickChip} activeOpacity={0.85} onPress={() => navigation?.navigate(q.go)}>
                <Text style={st.quickEmoji}>{q.e}</Text>
                <Text style={st.quickLabel}>{q.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* my workspace (self-service — no view switching needed) */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>MY WORKSPACE</Text>
          <View style={st.quickRow}>
            {[
              { e: '🏖️', l: 'Apply Leave',  go: 'ApplyLeave' },
              { e: '🎫', l: 'Raise Ticket', go: 'RaiseTicket' },
              { e: '💰', l: 'Payslip',      go: 'Payroll' },
              { e: '🕒', l: 'Timesheet',    go: 'Timesheet' },
              { e: '📝', l: 'Request',      go: 'CreateRequest' },
              { e: '🗓️', l: 'Team Calendar', go: 'TeamCalendar' },
            ].map((q) => (
              <TouchableOpacity key={q.l} style={st.quickChip} activeOpacity={0.85} onPress={() => navigation?.navigate(q.go)}>
                <Text style={st.quickEmoji}>{q.e}</Text>
                <Text style={st.quickLabelSm}>{q.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* new joiners */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>NEW JOINERS</Text>
          <View style={st.card}>
            {NEW_JOINERS.map((j, i, arr) => (
              <View key={j.name} style={[st.listRow, i < arr.length - 1 && st.listDivider]}>
                <View style={[st.listAvatar, { backgroundColor: avatarColor(j.name) }]}>
                  <Text style={st.listAvatarTx}>{initialsOf(j.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.listName}>{j.name}</Text>
                  <Text style={st.listSub}>{j.role}</Text>
                </View>
                <Text style={st.listMeta}>{j.when}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* celebrations */}
        <View style={[st.section, { marginBottom: 8 }]}>
          <Text style={st.sectionTitle}>CELEBRATIONS</Text>
          <View style={st.card}>
            {CELEBRATIONS.map((c, i, arr) => (
              <View key={c.name + c.when} style={[st.listRow, i < arr.length - 1 && st.listDivider]}>
                <View style={[st.listAvatar, { backgroundColor: avatarColor(c.name) }]}>
                  <Text style={st.listAvatarTx}>{initialsOf(c.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.listName}>{c.name}</Text>
                  <Text style={st.listSub}>{c.type}</Text>
                </View>
                <Text style={st.listMeta}>{c.when}</Text>
              </View>
            ))}
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

  reqCard: { flexDirection: 'row', backgroundColor: T.card, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  reqLeft: { width: 92, alignItems: 'center', justifyContent: 'center' },
  reqBig: { fontSize: 40, fontWeight: '800', color: T.primary },
  reqBigLabel: { fontSize: 11, color: T.sub, textAlign: 'center', marginTop: -2 },
  reqDivider: { width: 1, backgroundColor: T.line, marginHorizontal: 14 },
  reqKinds: { flex: 1, gap: 9 },
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

  quickRow: { flexDirection: 'row', gap: 10 },
  quickChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.card, borderRadius: 12, paddingVertical: 14, gap: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  quickEmoji: { fontSize: 16 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  quickLabelSm: { fontSize: 10.5, fontWeight: '600', color: '#374151', textAlign: 'center' },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  listDivider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  listAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  listAvatarTx: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  listName: { fontSize: 14, fontWeight: '600', color: T.ink },
  listSub: { fontSize: 12, color: T.sub, marginTop: 1 },
  listMeta: { fontSize: 11, color: T.faint },
});
