import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { toggleViewMode } from '../../store/slices/authSlice';
import { fetchNotifications } from '../../store/slices/notificationsSlice';
import { userApi } from '../../services/api';
import { T, initialsOf } from '../../data/managerData';
import Icon from '../../components/Icon';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
const headerDate = new Date()
  .toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  .toUpperCase();

const ROLES = ['admin', 'hr', 'manager', 'employee'];
const ROLE_COLOR: Record<string, string> = { admin: '#7C3AED', hr: '#EC4899', manager: '#3B82F6', employee: '#10B981' };

export default function AdminDashboardScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);
  const unread = useSelector((s: RootState) => s.notifications.items.filter((i) => !i.read).length);

  const [users, setUsers] = useState<{ role: string; isActive: boolean }[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    dispatch(fetchNotifications());
    (async () => {
      try { const { data } = await userApi.getAll(); setUsers(data); setOffline(false); }
      catch { setUsers([{ role: 'admin', isActive: true }, { role: 'hr', isActive: true }, { role: 'manager', isActive: true }, { role: 'employee', isActive: true }]); setOffline(true); }
    })();
  }, [dispatch]);

  const name = (user?.email?.split('@')[0] || 'Admin').replace(/\./g, ' ');
  const active = users.filter((u) => u.isActive).length;
  const counts = ROLES.reduce<Record<string, number>>((a, r) => { a[r] = users.filter((u) => u.role === r).length; return a; }, {});
  const maxCount = Math.max(1, ...Object.values(counts));

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <View style={st.headerTop}>
          <View>
            <Text style={st.hDate}>{headerDate}</Text>
            <Text style={st.hGreet}>{greeting()} 👋</Text>
            <Text style={st.hName}>{name} · Administrator</Text>
          </View>
          <View style={st.headerRight}>
            <TouchableOpacity style={st.bell} onPress={() => navigation?.navigate('Notifications')}>
              <Icon name="bell" size={18} color="#FFFFFF" />
              {unread > 0 && <View style={st.bellDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={[st.avatar, { backgroundColor: T.primary }]} onPress={() => navigation?.navigate('Profile')} activeOpacity={0.8}><Text style={st.avatarTx}>{initialsOf(name)}</Text></TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={st.switchPill} activeOpacity={0.8} onPress={() => dispatch(toggleViewMode())}>
          <Text style={st.switchTx}>🧭  Admin view</Text>
          <Text style={st.switchAction}>Switch to my view ›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={st.body} contentContainerStyle={st.bodyC} showsVerticalScrollIndicator={false}>
        {/* system status */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <Text style={st.cardTitle}>System Status</Text>
            <View style={[st.statusPill, { backgroundColor: offline ? '#FEF3C7' : '#D1FAE5' }]}>
              <View style={[st.statusDot, { backgroundColor: offline ? '#F59E0B' : '#10B981' }]} />
              <Text style={[st.statusTx, { color: offline ? '#B45309' : '#065F46' }]}>{offline ? 'API OFFLINE' : 'ALL SYSTEMS OK'}</Text>
            </View>
          </View>
          <View style={st.svcRow}>
            {[
              { l: 'API', ok: !offline },
              { l: 'Database', ok: !offline },
              { l: 'Storage', ok: true },
              { l: 'Auth', ok: true },
            ].map((s) => (
              <View key={s.l} style={st.svc}>
                <View style={[st.svcDot, { backgroundColor: s.ok ? '#10B981' : '#F59E0B' }]} />
                <Text style={st.svcLabel}>{s.l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* KPIs */}
        <View style={st.kpiRow}>
          {[
            { v: `${users.length}`, l: 'Total users', e: '👥', bg: '#EEF2FF' },
            { v: `${active}`, l: 'Active', e: '✅', bg: '#ECFDF5' },
            { v: `${users.length - active}`, l: 'Disabled', e: '🚫', bg: '#FEF2F2' },
          ].map((k) => (
            <View key={k.l} style={[st.kpiCard, { backgroundColor: k.bg }]}>
              <Text style={st.kpiEmoji}>{k.e}</Text>
              <Text style={st.kpiVal}>{k.v}</Text>
              <Text style={st.kpiLabel}>{k.l}</Text>
            </View>
          ))}
        </View>

        {/* users by role */}
        <View style={st.section}>
          <View style={st.sectionHead}>
            <Text style={st.sectionTitle}>USERS BY ROLE</Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Users')}><Text style={st.seeAll}>Manage ›</Text></TouchableOpacity>
          </View>
          <View style={st.card}>
            {ROLES.map((r) => (
              <View key={r} style={st.roleRow}>
                <Text style={st.roleLabel}>{r}</Text>
                <View style={st.roleTrack}>
                  <View style={[st.roleFill, { width: `${(counts[r] / maxCount) * 100}%`, backgroundColor: ROLE_COLOR[r] }]} />
                </View>
                <Text style={st.roleVal}>{counts[r] || 0}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* quick actions */}
        <View style={[st.section, { marginBottom: 8 }]}>
          <Text style={st.sectionTitle}>QUICK ACTIONS</Text>
          <View style={st.quickRow}>
            {[
              { e: '👤', l: 'Users', go: 'Users' },
              { e: '🏢', l: 'People', go: 'People' },
              { e: '📊', l: 'Insights', go: 'Insights' },
            ].map((q) => (
              <TouchableOpacity key={q.l} style={st.quickChip} activeOpacity={0.85} onPress={() => navigation?.navigate(q.go)}>
                <Text style={st.quickEmoji}>{q.e}</Text>
                <Text style={st.quickLabel}>{q.l}</Text>
              </TouchableOpacity>
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
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: T.ink },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTx: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  svcRow: { flexDirection: 'row', justifyContent: 'space-between' },
  svc: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  svcDot: { width: 8, height: 8, borderRadius: 4 },
  svcLabel: { fontSize: 12, color: T.sub, fontWeight: '500' },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'flex-start' },
  kpiEmoji: { fontSize: 18, marginBottom: 6 },
  kpiVal: { fontSize: 20, fontWeight: '800', color: T.ink },
  kpiLabel: { fontSize: 10.5, color: T.sub, marginTop: 2 },

  section: { marginBottom: 16 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.8, marginBottom: 12 },
  seeAll: { fontSize: 12, color: T.primary, fontWeight: '600' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  roleLabel: { width: 78, fontSize: 12, color: T.sub, textTransform: 'capitalize' },
  roleTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  roleFill: { height: 10, borderRadius: 5 },
  roleVal: { width: 20, textAlign: 'right', fontSize: 13, fontWeight: '700', color: T.ink },

  quickRow: { flexDirection: 'row', gap: 10 },
  quickChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.card, borderRadius: 12, paddingVertical: 14, gap: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  quickEmoji: { fontSize: 16 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
});
