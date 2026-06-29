import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Switch, RefreshControl, Alert,
} from 'react-native';
import { userApi } from '../../services/api';
import { T, initialsOf, avatarColor } from '../../data/managerData';

interface ApiUser { id: string; email: string; role: string; isActive: boolean; }

const ROLES = ['admin', 'hr', 'manager', 'employee'];
const ROLE_TINT: Record<string, { bg: string; fg: string }> = {
  admin:    { bg: '#EDE9FE', fg: '#5B21B6' },
  hr:       { bg: '#FCE7F3', fg: '#9D174D' },
  manager:  { bg: '#DBEAFE', fg: '#1E40AF' },
  employee: { bg: '#D1FAE5', fg: '#065F46' },
};

const MOCK_USERS: ApiUser[] = [
  { id: 'u-admin', email: 'admin@hrms.com', role: 'admin', isActive: true },
  { id: 'u-hr', email: 'hr@hrms.com', role: 'hr', isActive: true },
  { id: 'u-mgr', email: 'manager@hrms.com', role: 'manager', isActive: true },
  { id: 'u-emp', email: 'employee@hrms.com', role: 'employee', isActive: true },
];

export default function UserManagementScreen({ navigation }: any) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userApi.getAll();
      setUsers(data);
      setOffline(false);
    } catch {
      setUsers(MOCK_USERS);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cycleRole = async (u: ApiUser) => {
    const next = ROLES[(ROLES.indexOf(u.role) + 1) % ROLES.length];
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: next } : x)));
    try { await userApi.setRole(u.id, next); } catch { /* offline: keep optimistic */ }
  };

  const toggleActive = async (u: ApiUser) => {
    const next = !u.isActive;
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: next } : x)));
    try { await userApi.setActive(u.id, next); } catch { /* offline */ }
  };

  const counts = ROLES.reduce<Record<string, number>>((a, r) => { a[r] = users.filter((u) => u.role === r).length; return a; }, {});

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <View style={st.headerRow}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} style={st.back}><Text style={st.backTx}>‹</Text></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.hTitle}>User Management</Text>
            <Text style={st.hSub}>{users.length} users{offline ? ' · offline (demo)' : ' · live'}</Text>
          </View>
        </View>
        <View style={st.roleStrip}>
          {ROLES.map((r) => (
            <View key={r} style={st.roleStat}>
              <Text style={st.roleStatNum}>{counts[r] || 0}</Text>
              <Text style={st.roleStatLabel}>{r}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={T.primary} />}
      >
        <Text style={st.hint}>Tap a role chip to change it · toggle to activate / deactivate</Text>
        {users.map((u) => {
          const tint = ROLE_TINT[u.role] ?? ROLE_TINT.employee;
          const name = u.email.split('@')[0].replace(/\./g, ' ');
          return (
            <View key={u.id} style={[st.card, !u.isActive && st.cardInactive]}>
              <View style={[st.avatar, { backgroundColor: avatarColor(u.email) }]}>
                <Text style={st.avatarTx}>{initialsOf(name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.email} numberOfLines={1}>{u.email}</Text>
                <TouchableOpacity style={[st.roleChip, { backgroundColor: tint.bg }]} onPress={() => cycleRole(u)}>
                  <Text style={[st.roleChipTx, { color: tint.fg }]}>{u.role.toUpperCase()} ⇅</Text>
                </TouchableOpacity>
              </View>
              <View style={st.activeBox}>
                <Switch
                  value={u.isActive}
                  onValueChange={() => { toggleActive(u); }}
                  trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
                  thumbColor={u.isActive ? T.primary : '#F9FAFB'}
                />
                <Text style={[st.activeLabel, { color: u.isActive ? T.green.fg : T.faint }]}>{u.isActive ? 'Active' : 'Disabled'}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backTx: { color: '#FFF', fontSize: 26, fontWeight: '700', marginTop: -4 },
  hTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  hSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  roleStrip: { flexDirection: 'row', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 10 },
  roleStat: { flex: 1, alignItems: 'center' },
  roleStatNum: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  roleStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2, textTransform: 'capitalize' },

  body: { flex: 1 },
  hint: { fontSize: 12, color: T.faint, marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardInactive: { opacity: 0.6 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  email: { fontSize: 14, fontWeight: '600', color: T.ink },
  roleChip: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  roleChipTx: { fontSize: 10.5, fontWeight: '800' },
  activeBox: { alignItems: 'center' },
  activeLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
});
