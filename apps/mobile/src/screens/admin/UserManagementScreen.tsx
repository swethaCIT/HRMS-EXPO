import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Switch,
  RefreshControl, Alert, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { userApi } from '../../services/api';
import { T, initialsOf, avatarColor } from '../../data/managerData';
import Icon from '../../components/Icon';

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

type RoleFilter = 'all' | Role;
type StatusFilter = 'all' | 'active' | 'inactive';

const MOCK_USERS: ApiUser[] = [
  { id: 'u-admin', email: 'admin@hrms.com', role: 'admin', isActive: true },
  { id: 'u-hr', email: 'hr@hrms.com', role: 'hr', isActive: true },
  { id: 'u-mgr', email: 'manager@hrms.com', role: 'manager', isActive: true },
  { id: 'u-emp', email: 'employee@hrms.com', role: 'employee', isActive: true },
  { id: 'u-emp2', email: 'jane.doe@hrms.com', role: 'employee', isActive: false },
];

export default function UserManagementScreen({ navigation }: any) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) { setLoading(true); }
    try {
      const { data } = await userApi.getAll();
      setUsers(Array.isArray(data) ? data : []);
      setOffline(false);
    } catch {
      setUsers(MOCK_USERS);
      setOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  const applyRole = async (u: ApiUser, next: Role) => {
    setBusy(true);
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: next } : x)));
    setSelected((s) => (s && s.id === u.id ? { ...s, role: next } : s));
    try { await userApi.setRole(u.id, next); await load(true); } catch { /* keep optimistic */ }
    setBusy(false);
  };

  const applyActive = async (u: ApiUser, next: boolean) => {
    setBusy(true);
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: next } : x)));
    setSelected((s) => (s && s.id === u.id ? { ...s, isActive: next } : s));
    try { await userApi.setActive(u.id, next); await load(true); } catch { /* keep optimistic */ }
    setBusy(false);
  };

  const confirmRemove = (u: ApiUser) => {
    Alert.alert(
      'Remove user',
      `Remove ${u.email}? This deactivates their access and can be restored by an admin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            setBusy(true);
            setUsers((prev) => prev.filter((x) => x.id !== u.id));
            setSelected(null);
            try { await userApi.remove(u.id); await load(true); } catch { /* keep optimistic */ }
            setBusy(false);
          },
        },
      ],
    );
  };

  const counts = useMemo(
    () => ROLES.reduce<Record<string, number>>((a, r) => { a[r] = users.filter((u) => u.role === r).length; return a; }, {}),
    [users],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) { return false; }
      if (statusFilter === 'active' && !u.isActive) { return false; }
      if (statusFilter === 'inactive' && u.isActive) { return false; }
      if (q && !(u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q))) { return false; }
      return true;
    });
  }, [users, query, roleFilter, statusFilter]);

  const roleChips: { key: RoleFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'admin', label: 'Admin' },
    { key: 'hr', label: 'HR' },
    { key: 'manager', label: 'Manager' },
    { key: 'employee', label: 'Employee' },
  ];
  const statusChips: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Everyone' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
  ];

  const sm = selected ? roleMeta(selected.role) : null;
  const selName = selected ? selected.email.split('@')[0].replace(/\./g, ' ') : '';

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <View style={st.headerRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={st.back}><Text style={st.backTx}>‹</Text></TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={st.hTitle}>User Management</Text>
            <Text style={st.hSub}>
              {users.length} users · {counts.admin || 0} admins{offline ? ' · offline (demo)' : ''}
            </Text>
          </View>
        </View>
        <View style={st.search}>
          <Icon name="user" size={16} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={st.searchInput}
            placeholder="Search by email or role"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={st.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* filters */}
      <View style={st.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipRow}>
          {roleChips.map((c) => {
            const on = roleFilter === c.key;
            return (
              <TouchableOpacity key={c.key} style={[st.chip, on && st.chipOn]} onPress={() => setRoleFilter(c.key)} activeOpacity={0.8}>
                <Text style={[st.chipTx, on && st.chipTxOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[st.chipRow, { marginTop: 8 }]}>
          {statusChips.map((c) => {
            const on = statusFilter === c.key;
            return (
              <TouchableOpacity key={c.key} style={[st.chipSm, on && st.chipSmOn]} onPress={() => setStatusFilter(c.key)} activeOpacity={0.8}>
                <Text style={[st.chipSmTx, on && st.chipSmTxOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={T.primary} /></View>
      ) : (
        <ScrollView
          style={st.body}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        >
          <Text style={st.resultCount}>{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</Text>
          {filtered.length === 0 && (
            <View style={st.emptyBox}>
              <Icon name="users" size={28} color={T.faint} />
              <Text style={st.emptyTx}>No users match your filters</Text>
            </View>
          )}
          {filtered.map((u) => {
            const m = roleMeta(u.role);
            const name = u.email.split('@')[0].replace(/\./g, ' ');
            return (
              <TouchableOpacity
                key={u.id}
                style={[st.card, !u.isActive && st.cardInactive]}
                activeOpacity={0.7}
                onPress={() => setSelected(u)}
              >
                <View style={[st.avatar, { backgroundColor: avatarColor(u.email) }]}>
                  <Text style={st.avatarTx}>{initialsOf(name)}</Text>
                  <View style={[st.avDot, { backgroundColor: u.isActive ? T.green.solid : T.faint }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.email} numberOfLines={1}>{u.email}</Text>
                  <View style={[st.roleChip, { backgroundColor: m.bg, marginTop: 6 }]}>
                    <Text style={[st.roleChipTx, { color: m.fg }]}>{m.label.toUpperCase()}</Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={18} color={T.faint} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* action sheet */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={() => setSelected(null)} />
        {selected && sm && (
          <View style={st.sheet}>
            <View style={st.sheetHandle} />
            <View style={st.sheetHead}>
              <View style={[st.avatar, { backgroundColor: avatarColor(selected.email) }]}>
                <Text style={st.avatarTx}>{initialsOf(selName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.sheetEmail} numberOfLines={1}>{selected.email}</Text>
                <View style={[st.roleChip, { backgroundColor: sm.bg, marginTop: 4 }]}>
                  <Text style={[st.roleChipTx, { color: sm.fg }]}>{sm.label.toUpperCase()}</Text>
                </View>
              </View>
              {busy && <ActivityIndicator color={T.primary} />}
            </View>

            <Text style={st.sheetLabel}>ROLE</Text>
            <View style={st.segment}>
              {ROLES.map((r) => {
                const on = selected.role === r;
                const m = ROLE_META[r];
                return (
                  <TouchableOpacity
                    key={r}
                    style={[st.segItem, on && { backgroundColor: m.bg }]}
                    onPress={() => applyRole(selected, r)}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.segTx, on && { color: m.fg, fontWeight: '800' }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={st.sheetLabel}>STATUS</Text>
            <View style={st.statusRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.statusTitle}>{selected.isActive ? 'Account active' : 'Account disabled'}</Text>
                <Text style={st.statusSub}>{selected.isActive ? 'User can sign in and access the app' : 'Sign-in is blocked for this user'}</Text>
              </View>
              <Switch
                value={selected.isActive}
                onValueChange={(v) => applyActive(selected, v)}
                trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
                thumbColor={selected.isActive ? T.primary : '#F9FAFB'}
              />
            </View>

            <TouchableOpacity style={st.removeBtn} activeOpacity={0.85} onPress={() => confirmRemove(selected)}>
              <Icon name="log-out" size={16} color={T.red.fg} />
              <Text style={st.removeTx}>Remove user</Text>
            </TouchableOpacity>

            <TouchableOpacity style={st.closeBtn} activeOpacity={0.85} onPress={() => setSelected(null)}>
              <Text style={st.closeTx}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
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
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14, padding: 0 },
  searchClear: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700' },

  filters: { paddingTop: 12, paddingBottom: 4, backgroundColor: T.bg },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: T.card, borderWidth: 1, borderColor: T.line },
  chipOn: { backgroundColor: T.primary, borderColor: T.primary },
  chipTx: { fontSize: 12.5, fontWeight: '600', color: T.sub },
  chipTxOn: { color: '#FFF' },
  chipSm: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: T.card, borderWidth: 1, borderColor: T.line },
  chipSmOn: { backgroundColor: T.ink, borderColor: T.ink },
  chipSmTx: { fontSize: 11.5, fontWeight: '600', color: T.sub },
  chipSmTxOn: { color: '#FFF' },

  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resultCount: { fontSize: 11.5, fontWeight: '700', color: T.faint, letterSpacing: 0.5, marginBottom: 12 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTx: { fontSize: 13, color: T.faint },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardInactive: { opacity: 0.62 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  avDot: { position: 'absolute', bottom: -1, right: -1, width: 13, height: 13, borderRadius: 6.5, borderWidth: 2, borderColor: T.card },
  email: { fontSize: 14, fontWeight: '600', color: T.ink },
  roleChip: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleChipTx: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: T.line, marginBottom: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  sheetEmail: { fontSize: 15, fontWeight: '700', color: T.ink },
  sheetLabel: { fontSize: 11, fontWeight: '700', color: T.faint, letterSpacing: 0.8, marginBottom: 10 },

  segment: { flexDirection: 'row', backgroundColor: T.bg, borderRadius: 12, padding: 4, marginBottom: 20 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 9 },
  segTx: { fontSize: 12.5, fontWeight: '600', color: T.sub },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.bg, borderRadius: 12, padding: 14, marginBottom: 18 },
  statusTitle: { fontSize: 14, fontWeight: '700', color: T.ink },
  statusSub: { fontSize: 11.5, color: T.sub, marginTop: 2 },

  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.red.bg, borderRadius: 12, paddingVertical: 13, marginBottom: 10 },
  removeTx: { fontSize: 14, fontWeight: '700', color: T.red.fg },
  closeBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.line },
  closeTx: { fontSize: 14, fontWeight: '700', color: T.sub },
});
