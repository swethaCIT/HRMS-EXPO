import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchNotifications } from '../../store/slices/notificationsSlice';
import { userApi, analyticsApi, employeeApi } from '../../services/api';
import { T, initialsOf, avatarColor } from '../../data/managerData';
import Icon, { IconName } from '../../components/Icon';
import GoalsSection from '../projects/GoalsSection';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
const headerDate = new Date()
  .toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  .toUpperCase();

interface ApiUser { id: string; email: string; role: string; isActive: boolean; createdAt?: string; }

const ROLES = ['admin', 'hr', 'manager', 'employee'] as const;
type Role = typeof ROLES[number];

// admin=rose/red · hr=purple/violet · manager=blue/indigo · employee=green
const ROLE_META: Record<Role, { label: string; bg: string; fg: string; solid: string }> = {
  admin:    { label: 'Admin',    ...T.red },
  hr:       { label: 'HR',       ...T.purple },
  manager:  { label: 'Manager',  ...T.blue },
  employee: { label: 'Employee', ...T.green },
};
const roleMeta = (r: string) => ROLE_META[(r as Role)] ?? { label: r, bg: T.line, fg: T.sub, solid: T.faint };

const MOCK_USERS: ApiUser[] = [
  { id: 'u-admin', email: 'admin@hrms.com', role: 'admin', isActive: true, createdAt: '2026-06-01' },
  { id: 'u-hr', email: 'hr@hrms.com', role: 'hr', isActive: true, createdAt: '2026-06-04' },
  { id: 'u-mgr', email: 'manager@hrms.com', role: 'manager', isActive: true, createdAt: '2026-06-08' },
  { id: 'u-emp', email: 'employee@hrms.com', role: 'employee', isActive: true, createdAt: '2026-06-20' },
];

export default function AdminDashboardScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);
  const unread = useSelector((s: RootState) => s.notifications.items.filter((i) => !i.read).length);

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [headcount, setHeadcount] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let failed = false;
    try {
      const { data } = await userApi.getAll();
      setUsers(Array.isArray(data) ? data : []);
    } catch { setUsers(MOCK_USERS); failed = true; }

    try {
      const { data } = await analyticsApi.summary();
      const hc = data?.headcount ?? data?.totalHeadcount ?? null;
      if (typeof hc === 'number') { setHeadcount(hc); }
      else {
        const { data: emps } = await employeeApi.getAll();
        setHeadcount(Array.isArray(emps) ? emps.length : null);
      }
    } catch {
      try { const { data: emps } = await employeeApi.getAll(); setHeadcount(Array.isArray(emps) ? emps.length : null); }
      catch { setHeadcount(null); failed = true; }
    }
    setOffline(failed);
  }, []);

  useEffect(() => {
    dispatch(fetchNotifications());
    load();
  }, [dispatch, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const name = (user?.email?.split('@')[0] || 'Admin').replace(/\./g, ' ');
  const active = users.filter((u) => u.isActive).length;
  const privileged = users.filter((u) => u.role === 'admin' || u.role === 'manager' || u.role === 'hr').length;
  const counts = ROLES.reduce<Record<string, number>>((a, r) => { a[r] = users.filter((u) => u.role === r).length; return a; }, {});
  const totalRoled = Math.max(1, users.length);

  const recent = [...users]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 5);

  const kpis: { v: string; l: string; icon: IconName; bg: string; fg: string }[] = [
    { v: `${users.length}`, l: 'Total users', icon: 'users', bg: T.purple.bg, fg: T.purple.solid },
    { v: `${active}`, l: 'Active', icon: 'check-square', bg: T.green.bg, fg: T.green.solid },
    { v: `${privileged}`, l: 'Privileged', icon: 'shield', bg: T.blue.bg, fg: T.blue.solid },
    { v: headcount != null ? `${headcount}` : '—', l: 'Headcount', icon: 'briefcase', bg: T.amber.bg, fg: T.amber.solid },
  ];

  const quick: { l: string; sub: string; icon: IconName; go: string; fg: string; bg: string }[] = [
    { l: 'User Management', sub: 'Roles & access', icon: 'user', go: 'Users', fg: T.primary, bg: '#EEF2FF' },
    { l: 'People', sub: 'Directory', icon: 'users', go: 'People', fg: T.green.solid, bg: T.green.bg },
    { l: 'Insights', sub: 'Analytics', icon: 'bar-chart', go: 'Insights', fg: T.amber.solid, bg: T.amber.bg },
  ];

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <View style={st.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={st.hDate}>{headerDate}</Text>
            <Text style={st.hGreet}>{greeting()}</Text>
            <Text style={st.hName}>{name} · Administrator</Text>
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
        <View style={st.switchPill}>
          <View style={st.switchLeft}>
            <View style={st.switchIcon}><Icon name="shield" size={14} color="#C7D2FE" /></View>
            <Text style={st.switchTx}>Admin control center</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={st.body}
        contentContainerStyle={st.bodyC}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {offline && (
          <View style={st.offline}>
            <View style={[st.svcDot, { backgroundColor: T.amber.solid }]} />
            <Text style={st.offlineTx}>Backend unreachable · showing demo data</Text>
          </View>
        )}

        {/* KPI grid */}
        <View style={st.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.l} style={st.kpiCard}>
              <View style={[st.kpiIcon, { backgroundColor: k.bg }]}>
                <Icon name={k.icon} size={18} color={k.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.kpiVal}>{k.v}</Text>
                <Text style={st.kpiLabel}>{k.l}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* System overview — roles breakdown */}
        <View style={st.section}>
          <View style={st.sectionHead}>
            <Text style={st.sectionTitle}>SYSTEM OVERVIEW</Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Users')}>
              <Text style={st.seeAll}>Manage ›</Text>
            </TouchableOpacity>
          </View>
          <View style={st.card}>
            <View style={st.overviewHead}>
              <Text style={st.overviewTitle}>Users by role</Text>
              <Text style={st.overviewSub}>{users.length} total</Text>
            </View>
            {ROLES.map((r) => {
              const m = ROLE_META[r];
              const c = counts[r] || 0;
              return (
                <View key={r} style={st.roleRow}>
                  <View style={[st.roleChip, { backgroundColor: m.bg }]}>
                    <Text style={[st.roleChipTx, { color: m.fg }]}>{m.label}</Text>
                  </View>
                  <View style={st.roleTrack}>
                    <View style={[st.roleFill, { width: `${(c / totalRoled) * 100}%`, backgroundColor: m.solid }]} />
                  </View>
                  <Text style={st.roleVal}>{c}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Goals (project boards) */}
        <GoalsSection navigation={navigation} />

        {/* Quick actions */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>QUICK ACTIONS</Text>
          <View style={st.quickRow}>
            {quick.map((q) => (
              <TouchableOpacity key={q.l} style={st.quickCard} activeOpacity={0.85} onPress={() => navigation?.navigate(q.go)}>
                <View style={[st.quickIcon, { backgroundColor: q.bg }]}>
                  <Icon name={q.icon} size={20} color={q.fg} />
                </View>
                <Text style={st.quickLabel}>{q.l}</Text>
                <Text style={st.quickSub}>{q.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent users */}
        <View style={[st.section, { marginBottom: 4 }]}>
          <View style={st.sectionHead}>
            <Text style={st.sectionTitle}>RECENT USERS</Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Users')}>
              <Text style={st.seeAll}>View all ›</Text>
            </TouchableOpacity>
          </View>
          <View style={st.card}>
            {recent.length === 0 && <Text style={st.empty}>No users yet.</Text>}
            {recent.map((u, i) => {
              const m = roleMeta(u.role);
              const uname = u.email.split('@')[0].replace(/\./g, ' ');
              return (
                <View key={u.id} style={[st.userRow, i < recent.length - 1 && st.userRowBorder]}>
                  <View style={[st.userAvatar, { backgroundColor: avatarColor(u.email) }]}>
                    <Text style={st.userAvatarTx}>{initialsOf(uname)}</Text>
                    <View style={[st.userDot, { backgroundColor: u.isActive ? T.green.solid : T.faint }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.userEmail} numberOfLines={1}>{u.email}</Text>
                    <Text style={st.userStatus}>{u.isActive ? 'Active' : 'Disabled'}</Text>
                  </View>
                  <View style={[st.roleChip, { backgroundColor: m.bg }]}>
                    <Text style={[st.roleChipTx, { color: m.fg }]}>{m.label}</Text>
                  </View>
                </View>
              );
            })}
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
  switchLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  switchTx: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  switchAction: { color: '#C7D2FE', fontWeight: '600', fontSize: 12 },

  body: { flex: 1 },
  bodyC: { padding: 16, paddingBottom: 28 },

  offline: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.amber.bg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14 },
  offlineTx: { fontSize: 12, color: T.amber.fg, fontWeight: '600' },

  card: { backgroundColor: T.card, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  kpiCard: { width: '47.8%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kpiVal: { fontSize: 22, fontWeight: '800', color: T.ink },
  kpiLabel: { fontSize: 11.5, color: T.sub, marginTop: 1 },

  section: { marginBottom: 20 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.8, marginBottom: 12 },
  seeAll: { fontSize: 12, color: T.primary, fontWeight: '600', marginBottom: 12 },

  overviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  overviewTitle: { fontSize: 15, fontWeight: '700', color: T.ink },
  overviewSub: { fontSize: 12, color: T.sub, fontWeight: '600' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  roleChip: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, minWidth: 74, alignItems: 'center' },
  roleChipTx: { fontSize: 11, fontWeight: '800' },
  roleTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  roleFill: { height: 8, borderRadius: 4 },
  roleVal: { width: 22, textAlign: 'right', fontSize: 13, fontWeight: '700', color: T.ink },

  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, backgroundColor: T.card, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  quickIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickLabel: { fontSize: 13, fontWeight: '700', color: T.ink },
  quickSub: { fontSize: 11, color: T.sub, marginTop: 2 },

  svcDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { fontSize: 13, color: T.faint, textAlign: 'center', paddingVertical: 8 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  userRowBorder: { borderBottomWidth: 1, borderBottomColor: T.line },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  userAvatarTx: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  userDot: { position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: T.card },
  userEmail: { fontSize: 13.5, fontWeight: '600', color: T.ink },
  userStatus: { fontSize: 11.5, color: T.sub, marginTop: 1 },
});
