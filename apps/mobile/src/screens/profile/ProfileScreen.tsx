import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Switch, Alert, Linking,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { logout, toggleViewMode, isManagerRole, managementKind } from '../../store/slices/authSlice';
import { T, initialsOf } from '../../data/managerData';
import Icon, { IconName } from '../../components/Icon';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', hr: 'HR Manager', manager: 'Team Manager', employee: 'Employee',
};

const titleCase = (s?: string) =>
  (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}
function tenure(d?: string) {
  if (!d) return null;
  const start = new Date(d).getTime();
  if (!start) return null;
  const months = Math.max(0, Math.round((Date.now() - start) / (1000 * 60 * 60 * 24 * 30)));
  const y = Math.floor(months / 12), m = months % 12;
  return `${y ? `${y}y ` : ''}${m}mo`;
}

export default function ProfileScreen({ navigation }: any) {
  const { user, employee, viewMode } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();

  const fullName = employee
    ? `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()
    : (user?.email?.split('@')[0] || 'User').replace(/\./g, ' ');
  const canManage = isManagerRole(user?.role);
  const kind = managementKind(user?.role); // 'admin' | 'hr' | 'manager' | null
  const viewLabel = kind === 'admin' ? 'Admin view' : kind === 'hr' ? 'HR view' : 'Manager view';
  const statusActive = (employee?.status ?? 'active') === 'active';

  const managerRows: { icon: IconName; label: string; go?: string; hint?: string }[] =
    kind === 'admin'
      ? [
          { icon: 'user', label: 'User Management', go: 'Users', hint: 'Admin' },
          { icon: 'users', label: 'People', go: 'People' },
          { icon: 'bar-chart', label: 'Org Insights', go: 'Insights' },
        ]
      : kind === 'hr'
        ? [
            { icon: 'inbox', label: 'Requests', go: 'Requests', hint: 'Process' },
            { icon: 'users', label: 'People', go: 'People' },
            { icon: 'bar-chart', label: 'Org Insights', go: 'Insights' },
          ]
        : [
            { icon: 'check-square', label: 'Approvals', go: 'Approvals', hint: 'Review' },
            { icon: 'users', label: 'My Team', go: 'Team' },
            { icon: 'bar-chart', label: 'Team Insights', go: 'Insights' },
          ];

  const SHORTCUTS: { icon: IconName; label: string; go?: string; hint?: string }[] = canManage
    ? [...managerRows, { icon: 'credit-card', label: 'My Payslip', go: 'Payroll' }, { icon: 'clock', label: 'My Timesheet', go: 'Timesheet' }]
    : [
        { icon: 'credit-card', label: 'My Payslip', go: 'Payroll' },
        { icon: 'clock', label: 'My Timesheet', go: 'Timesheet' },
        { icon: 'box', label: 'My Assets', go: 'Assets' },
      ];

  const soon = (what: string) => Alert.alert(what, 'This section is coming soon.');
  const confirmLogout = () =>
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);

  // Employment detail rows (only show ones we actually have)
  const details: { label: string; value: string }[] = [
    { label: 'Employee ID', value: employee?.employeeId || '—' },
    { label: 'Designation', value: employee?.designation || '—' },
    { label: 'Department', value: employee?.department || '—' },
    { label: 'Employment type', value: titleCase(employee?.employmentType) },
    { label: 'Status', value: titleCase(employee?.status) },
    { label: 'Date of joining', value: fmtDate(employee?.dateOfJoining) },
  ];
  const ten = tenure(employee?.dateOfJoining);

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      {/* ── Header ── */}
      <View style={st.header}>
        <View style={[st.avatar, { backgroundColor: T.primary }]}>
          <Text style={st.avatarTx}>{initialsOf(fullName)}</Text>
        </View>
        <Text style={st.name}>{fullName}</Text>
        {!!(employee?.designation || employee?.department) && (
          <Text style={st.subtitle}>
            {employee?.designation || 'Employee'}{employee?.department ? ` · ${employee.department}` : ''}
          </Text>
        )}
        <View style={st.badgeRow}>
          <View style={st.roleBadge}><Text style={st.roleTx}>{ROLE_LABEL[user?.role || 'employee'] ?? 'Employee'}</Text></View>
          {!!employee?.employeeId && <View style={st.idBadge}><Text style={st.idTx}>{employee.employeeId}</Text></View>}
          <View style={[st.statusDot, { backgroundColor: statusActive ? '#34D399' : '#9CA3AF' }]} />
          <Text style={st.statusTx}>{statusActive ? 'Active' : titleCase(employee?.status)}</Text>
        </View>
      </View>

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* view switch (managers) */}
        {canManage && (
          <View style={st.switchCard}>
            <View style={{ flex: 1 }}>
              <Text style={st.switchTitle}>{viewLabel}</Text>
              <Text style={st.switchSub}>Switch between your {kind === 'manager' ? 'team' : 'organization'} dashboard and your personal employee view.</Text>
            </View>
            <Switch
              value={viewMode === 'manager'}
              onValueChange={() => { dispatch(toggleViewMode()); }}
              trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
              thumbColor={viewMode === 'manager' ? T.primary : '#F9FAFB'}
            />
          </View>
        )}

        {/* Employment details */}
        <Text style={st.sectionTitle}>EMPLOYMENT DETAILS</Text>
        <View style={st.card}>
          {details.map((d, i) => (
            <View key={d.label} style={[st.detailRow, i < details.length - 1 && st.rowDivider]}>
              <Text style={st.detailK}>{d.label}</Text>
              <Text style={st.detailV}>{d.value}{d.label === 'Date of joining' && ten ? `  ·  ${ten}` : ''}</Text>
            </View>
          ))}
        </View>

        {/* Contact */}
        <Text style={st.sectionTitle}>CONTACT</Text>
        <View style={st.card}>
          <TouchableOpacity style={[st.row, st.rowDivider]} onPress={() => user?.email && Linking.openURL(`mailto:${user.email}`)}>
            <View style={st.rowIcon}><Icon name="inbox" size={17} color={T.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.rowSubLabel}>Email</Text>
              <Text style={st.rowLabel}>{user?.email || '—'}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={st.row} onPress={() => employee?.phone && Linking.openURL(`tel:${employee.phone.replace(/\s/g, '')}`)}>
            <View style={st.rowIcon}><Icon name="user" size={17} color={T.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.rowSubLabel}>Phone</Text>
              <Text style={st.rowLabel}>{employee?.phone || '—'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Shortcuts */}
        <Text style={st.sectionTitle}>SHORTCUTS</Text>
        <View style={st.card}>
          {SHORTCUTS.map((r, i, arr) => (
            <TouchableOpacity key={r.label} style={[st.row, i < arr.length - 1 && st.rowDivider]} onPress={() => r.go && navigation?.navigate(r.go)}>
              <View style={st.rowIcon}><Icon name={r.icon} size={17} color={T.primary} /></View>
              <Text style={st.rowLabel}>{r.label}</Text>
              {r.hint && <Text style={st.rowHint}>{r.hint}</Text>}
              <Icon name="chevron-right" size={18} color="#D1D5DB" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Account */}
        <Text style={st.sectionTitle}>ACCOUNT</Text>
        <View style={st.card}>
          <TouchableOpacity style={[st.row, st.rowDivider]} onPress={() => navigation?.navigate('Notifications')}>
            <View style={st.rowIcon}><Icon name="bell" size={17} color={T.primary} /></View>
            <Text style={st.rowLabel}>Notifications</Text>
            <Icon name="chevron-right" size={18} color="#D1D5DB" />
          </TouchableOpacity>
          <TouchableOpacity style={[st.row, st.rowDivider]} onPress={() => soon('Privacy & Security')}>
            <View style={st.rowIcon}><Icon name="shield" size={17} color={T.primary} /></View>
            <Text style={st.rowLabel}>Privacy & Security</Text>
            <Icon name="chevron-right" size={18} color="#D1D5DB" />
          </TouchableOpacity>
          <TouchableOpacity style={st.row} onPress={() => soon('Help & Support')}>
            <View style={st.rowIcon}><Icon name="help-circle" size={17} color={T.primary} /></View>
            <Text style={st.rowLabel}>Help & Support</Text>
            <Icon name="chevron-right" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={st.logoutBtn} onPress={confirmLogout}>
          <Icon name="log-out" size={17} color="#DC2626" />
          <Text style={st.logoutTx}>Sign Out</Text>
        </TouchableOpacity>
        <Text style={st.version}>HRMS · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 22, alignItems: 'center', paddingHorizontal: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  avatarTx: { color: '#FFF', fontWeight: '800', fontSize: 28 },
  name: { fontSize: 20, fontWeight: '700', color: '#FFF', marginTop: 12, textTransform: 'capitalize' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  roleBadge: { backgroundColor: T.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  roleTx: { color: '#FFF', fontWeight: '700', fontSize: 11.5 },
  idBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  idTx: { color: '#FFF', fontWeight: '700', fontSize: 11.5 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  statusTx: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },

  body: { flex: 1 },
  switchCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  switchTitle: { fontSize: 15, fontWeight: '700', color: T.ink },
  switchSub: { fontSize: 12, color: T.sub, marginTop: 3, lineHeight: 17 },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  card: { backgroundColor: T.card, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  detailK: { fontSize: 13, color: T.sub },
  detailV: { fontSize: 13.5, color: T.ink, fontWeight: '600', maxWidth: '62%', textAlign: 'right' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  rowSubLabel: { fontSize: 11, color: T.faint },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: T.ink },
  rowHint: { fontSize: 12, color: T.faint, marginRight: 6 },

  logoutBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
  logoutTx: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', color: T.faint, fontSize: 12, marginTop: 16 },
});
