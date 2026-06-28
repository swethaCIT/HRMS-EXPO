import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput,
} from 'react-native';
import { PRESENCE_META, initialsOf, avatarColor } from '../../data/managerData';
import { T, HR_PEOPLE } from '../../data/hrData';

export default function PeopleScreen({ navigation }: any) {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState<'All' | string>('All');

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(HR_PEOPLE.map((p) => p.department)))],
    [],
  );

  const list = useMemo(() => {
    return HR_PEOPLE.filter((p) => {
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
        <Text style={st.hTitle}>People</Text>
        <Text style={st.hSub}>{HR_PEOPLE.length} employees · {departments.length - 1} departments</Text>
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
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20 },
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
});
