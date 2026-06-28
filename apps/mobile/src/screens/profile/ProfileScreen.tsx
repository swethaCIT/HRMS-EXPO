import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Switch,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { logout, toggleViewMode, isManagerRole } from '../../store/slices/authSlice';
import { T, initialsOf } from '../../data/managerData';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', hr: 'HR Manager', manager: 'Team Manager', employee: 'Employee',
};

export default function ProfileScreen({ navigation }: any) {
  const { user, viewMode } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();

  const name = (user?.email?.split('@')[0] || 'User').replace(/\./g, ' ');
  const canManage = isManagerRole(user?.role);

  const ROWS: { icon: string; label: string; go?: string; hint?: string }[] = canManage
    ? [
        { icon: '✅', label: 'Approvals', go: 'Approvals', hint: 'Review requests' },
        { icon: '👥', label: 'My Team', go: 'Team' },
        { icon: '📈', label: 'Team Insights', go: 'Insights' },
        { icon: '💳', label: 'My Payslip', go: 'Payroll' },
        { icon: '⏱️', label: 'My Timesheet', go: 'Timesheet' },
      ]
    : [
        { icon: '💳', label: 'My Payslip', go: 'Payroll' },
        { icon: '⏱️', label: 'My Timesheet', go: 'Timesheet' },
        { icon: '📦', label: 'My Assets', go: 'Assets' },
      ];

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      <View style={st.header}>
        <View style={[st.avatar, { backgroundColor: T.primary }]}>
          <Text style={st.avatarTx}>{initialsOf(name)}</Text>
        </View>
        <Text style={st.name}>{name}</Text>
        <Text style={st.email}>{user?.email}</Text>
        <View style={st.roleBadge}>
          <Text style={st.roleTx}>{ROLE_LABEL[user?.role || 'employee'] ?? 'Employee'}</Text>
        </View>
      </View>

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* view switch (managers only) */}
        {canManage && (
          <View style={st.switchCard}>
            <View style={{ flex: 1 }}>
              <Text style={st.switchTitle}>Manager view</Text>
              <Text style={st.switchSub}>Toggle between your team dashboard and your personal employee view.</Text>
            </View>
            <Switch
              value={viewMode === 'manager'}
              onValueChange={() => { dispatch(toggleViewMode()); }}
              trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
              thumbColor={viewMode === 'manager' ? T.primary : '#F9FAFB'}
            />
          </View>
        )}

        {/* shortcuts */}
        <Text style={st.sectionTitle}>SHORTCUTS</Text>
        <View style={st.card}>
          {ROWS.map((r, i, arr) => (
            <TouchableOpacity
              key={r.label}
              style={[st.row, i < arr.length - 1 && st.rowDivider]}
              onPress={() => r.go && navigation?.navigate(r.go)}
            >
              <View style={st.rowIcon}><Text style={{ fontSize: 16 }}>{r.icon}</Text></View>
              <Text style={st.rowLabel}>{r.label}</Text>
              {r.hint && <Text style={st.rowHint}>{r.hint}</Text>}
              <Text style={st.rowChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* account */}
        <Text style={st.sectionTitle}>ACCOUNT</Text>
        <View style={st.card}>
          {[
            { icon: '🔔', label: 'Notifications' },
            { icon: '🔒', label: 'Privacy & Security' },
            { icon: '❓', label: 'Help & Support' },
          ].map((r, i, arr) => (
            <TouchableOpacity key={r.label} style={[st.row, i < arr.length - 1 && st.rowDivider]}>
              <View style={st.rowIcon}><Text style={{ fontSize: 16 }}>{r.icon}</Text></View>
              <Text style={st.rowLabel}>{r.label}</Text>
              <Text style={st.rowChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={st.logoutBtn} onPress={() => dispatch(logout())}>
          <Text style={st.logoutTx}>Sign Out</Text>
        </TouchableOpacity>
        <Text style={st.version}>HRMS · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 52, paddingBottom: 24, alignItems: 'center' },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  avatarTx: { color: '#FFF', fontWeight: '800', fontSize: 30 },
  name: { fontSize: 20, fontWeight: '700', color: '#FFF', marginTop: 12, textTransform: 'capitalize' },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5, marginTop: 12 },
  roleTx: { color: '#FFF', fontWeight: '700', fontSize: 12 },

  body: { flex: 1 },
  switchCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  switchTitle: { fontSize: 15, fontWeight: '700', color: T.ink },
  switchSub: { fontSize: 12, color: T.sub, marginTop: 3, lineHeight: 17 },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.8, marginBottom: 12, marginTop: 4 },
  card: { backgroundColor: T.card, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: T.ink },
  rowHint: { fontSize: 12, color: T.faint, marginRight: 6 },
  rowChevron: { fontSize: 20, color: '#D1D5DB', fontWeight: '700' },

  logoutBtn: { backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  logoutTx: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', color: T.faint, fontSize: 12, marginTop: 16 },
});
