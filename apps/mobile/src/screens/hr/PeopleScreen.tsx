import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { PRESENCE_META, initialsOf, avatarColor, TeamMember } from '../../data/managerData';
import { T, HR_PEOPLE } from '../../data/hrData';
import { employeeApi, onboardingApi } from '../../services/api';

export default function PeopleScreen({ navigation }: any) {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState<'All' | string>('All');
  const [people, setPeople] = useState<TeamMember[]>(HR_PEOPLE);
  const [live, setLive] = useState(false);

  // ── New-hire onboarding invite ──
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inv, setInv] = useState({ personalEmail: '', firstName: '', lastName: '', department: '', designation: '' });
  const setInvF = (k: keyof typeof inv, v: string) => setInv((p) => ({ ...p, [k]: v }));

  const sendInvite = async () => {
    if (!inv.personalEmail.trim()) return Alert.alert('Email required', "Enter the candidate's personal email.");
    setInviting(true);
    try {
      const { data } = await onboardingApi.invite(inv);
      setInviteOpen(false);
      setInv({ personalEmail: '', firstName: '', lastName: '', department: '', designation: '' });
      Alert.alert(
        'Invitation sent 📨',
        `${data.personalEmail} has been invited (Temp ID ${data.tempEmployeeId}).` +
          (data.devCode ? `\n\nDev mode — invite code: ${data.devCode}` : '\n\nThey\'ll receive an email with a one-time code.'),
      );
    } catch (e: any) {
      Alert.alert('Could not send invite', e?.response?.data?.message || 'Please try again.');
    } finally { setInviting(false); }
  };

  // Pull the real employee directory from Supabase; fall back to mock offline.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await employeeApi.getAll();
        if (Array.isArray(data) && data.length) {
          const mapped: TeamMember[] = data.map((e: any) => ({
            id: e.id,
            employeeId: e.employeeId,
            name: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || (e.user?.email ?? 'Employee'),
            designation: e.designation || '—',
            department: e.department || 'General',
            email: e.user?.email || '',
            phone: e.phone || '',
            presence: 'in',
            checkIn: '09:00 AM',
            attendancePct: 95, leaveBalance: 12, utilization: 80, performance: 85, pending: 0, projects: [],
          }));
          setPeople(mapped);
          setLive(true);
        }
      } catch { /* keep mock fallback */ }
    })();
  }, []);

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(people.map((p) => p.department)))],
    [people],
  );

  const list = useMemo(() => {
    return people.filter((p) => {
      const matchDept = dept === 'All' || p.department === dept;
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.designation.toLowerCase().includes(q.toLowerCase()) ||
        p.employeeId.toLowerCase().includes(q.toLowerCase());
      return matchDept && matchQ;
    });
  }, [q, dept]);

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <View style={st.titleRow}>
          <Text style={st.hTitle}>People</Text>
          <TouchableOpacity style={st.inviteBtn} onPress={() => setInviteOpen(true)}>
            <Text style={st.inviteBtnTx}>＋ Invite</Text>
          </TouchableOpacity>
        </View>
        <Text style={st.hSub}>{people.length} employees · {departments.length - 1} departments{live ? ' · live' : ''}</Text>
        <View style={st.searchBox}>
          <Text style={{ fontSize: 15 }}>🔍</Text>
          <TextInput
            style={st.searchInput}
            placeholder="Search name, role, employee ID"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={q}
            onChangeText={setQ}
          />
        </View>
      </View>

      <View style={st.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {departments.map((d) => (
            <TouchableOpacity key={d} style={[st.chip, dept === d && st.chipActive]} onPress={() => setDept(d)}>
              <Text style={[st.chipTx, dept === d && st.chipTxActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 96 }} showsVerticalScrollIndicator={false}>
        {list.length === 0 && (
          <View style={st.empty}><Text style={{ fontSize: 38 }}>🔍</Text><Text style={st.emptyTx}>No employees match</Text></View>
        )}
        {list.map((p) => {
          const pm = PRESENCE_META[p.presence];
          return (
            <TouchableOpacity key={p.id} style={st.card} activeOpacity={0.85} onPress={() => navigation?.navigate('TeamMember', { member: p })}>
              <View style={{ position: 'relative' }}>
                <View style={[st.avatar, { backgroundColor: avatarColor(p.name) }]}>
                  <Text style={st.avatarTx}>{initialsOf(p.name)}</Text>
                </View>
                <View style={[st.presenceDot, { backgroundColor: pm.dot }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{p.name}</Text>
                <Text style={st.desig}>{p.designation}</Text>
                <View style={st.metaRow}>
                  <View style={st.deptTag}><Text style={st.deptTagTx}>{p.department}</Text></View>
                  <Text style={st.empId}>{p.employeeId}</Text>
                </View>
              </View>
              <View style={[st.presChip, { backgroundColor: pm.chipBg }]}>
                <Text style={[st.presChipTx, { color: pm.chipFg }]}>{pm.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Invite new hire modal ── */}
      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <View style={st.mOverlay}>
          <View style={st.mSheet}>
            <View style={st.mHandle} />
            <Text style={st.mTitle}>Invite a new hire</Text>
            <Text style={st.mSub}>They'll get a one-time code by email to self-register before joining.</Text>
            <TextInput style={st.mInput} placeholder="Personal email *" placeholderTextColor="#9CA3AF" autoCapitalize="none" keyboardType="email-address" value={inv.personalEmail} onChangeText={(v) => setInvF('personalEmail', v)} />
            <View style={st.mRow}>
              <TextInput style={[st.mInput, { flex: 1 }]} placeholder="First name" placeholderTextColor="#9CA3AF" value={inv.firstName} onChangeText={(v) => setInvF('firstName', v)} />
              <TextInput style={[st.mInput, { flex: 1 }]} placeholder="Last name" placeholderTextColor="#9CA3AF" value={inv.lastName} onChangeText={(v) => setInvF('lastName', v)} />
            </View>
            <View style={st.mRow}>
              <TextInput style={[st.mInput, { flex: 1 }]} placeholder="Department" placeholderTextColor="#9CA3AF" value={inv.department} onChangeText={(v) => setInvF('department', v)} />
              <TextInput style={[st.mInput, { flex: 1 }]} placeholder="Designation" placeholderTextColor="#9CA3AF" value={inv.designation} onChangeText={(v) => setInvF('designation', v)} />
            </View>
            <TouchableOpacity style={st.mBtn} onPress={sendInvite} disabled={inviting}>
              {inviting ? <ActivityIndicator color="#fff" /> : <Text style={st.mBtnTx}>Send invitation</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setInviteOpen(false)}><Text style={st.mCancel}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteBtn: { backgroundColor: T.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  inviteBtnTx: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  hTitle: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  hSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 12, marginTop: 16, height: 44 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },

  filterBar: { backgroundColor: '#FFF', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  chip: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#F3F4F6' },
  chipActive: { backgroundColor: T.primary },
  chipTx: { fontSize: 13, color: T.sub, fontWeight: '600' },
  chipTxActive: { color: '#FFF' },

  body: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  presenceDot: { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#FFF' },
  name: { fontSize: 15, fontWeight: '700', color: T.ink },
  desig: { fontSize: 12, color: T.sub, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  deptTag: { backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deptTagTx: { fontSize: 10.5, fontWeight: '700', color: T.primary },
  empId: { fontSize: 11, color: T.faint, fontWeight: '600' },
  presChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  presChipTx: { fontSize: 10, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 70, gap: 12 },
  emptyTx: { fontSize: 14, color: T.faint, fontWeight: '500' },

  mOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  mSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 14 },
  mHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  mTitle: { fontSize: 18, fontWeight: '800', color: T.ink },
  mSub: { fontSize: 13, color: T.sub, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  mInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 13, marginBottom: 12, fontSize: 15, color: T.ink, backgroundColor: '#FAFAFA' },
  mRow: { flexDirection: 'row', gap: 12 },
  mBtn: { backgroundColor: T.primary, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  mBtnTx: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  mCancel: { color: T.sub, textAlign: 'center', marginTop: 14, fontWeight: '600', fontSize: 14 },
});
