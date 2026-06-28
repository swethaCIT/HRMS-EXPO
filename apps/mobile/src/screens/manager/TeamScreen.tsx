import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput,
} from 'react-native';
import {
  T, TEAM, PRESENCE_META, Presence, initialsOf, avatarColor,
} from '../../data/managerData';

const FILTERS: { key: 'all' | Presence; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'In office' },
  { key: 'remote', label: 'Remote' },
  { key: 'leave', label: 'On leave' },
  { key: 'out', label: 'Not in' },
];

export default function TeamScreen({ navigation }: any) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | Presence>('all');

  const list = useMemo(() => {
    return TEAM.filter((m) => {
      const matchesFilter = filter === 'all' || m.presence === filter;
      const matchesQ =
        !q ||
        m.name.toLowerCase().includes(q.toLowerCase()) ||
        m.designation.toLowerCase().includes(q.toLowerCase()) ||
        m.department.toLowerCase().includes(q.toLowerCase());
      return matchesFilter && matchesQ;
    });
  }, [q, filter]);

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      <View style={st.header}>
        <Text style={st.hTitle}>My Team</Text>
        <Text style={st.hSub}>{TEAM.length} members · {TEAM.filter((m) => m.presence === 'in' || m.presence === 'remote').length} available now</Text>

        <View style={st.searchBox}>
          <Text style={{ fontSize: 15 }}>🔍</Text>
          <TextInput
            style={st.searchInput}
            placeholder="Search name, role, department"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={q}
            onChangeText={setQ}
          />
        </View>
      </View>

      <View style={st.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f.key} style={[st.chip, filter === f.key && st.chipActive]} onPress={() => setFilter(f.key)}>
              <Text style={[st.chipTx, filter === f.key && st.chipTxActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 96 }} showsVerticalScrollIndicator={false}>
        {list.length === 0 && (
          <View style={st.empty}><Text style={{ fontSize: 38 }}>🔍</Text><Text style={st.emptyTx}>No members match</Text></View>
        )}
        {list.map((m) => {
          const pm = PRESENCE_META[m.presence];
          return (
            <TouchableOpacity key={m.id} style={st.card} activeOpacity={0.85} onPress={() => navigation?.navigate('TeamMember', { id: m.id })}>
              <View style={{ position: 'relative' }}>
                <View style={[st.avatar, { backgroundColor: avatarColor(m.name) }]}>
                  <Text style={st.avatarTx}>{initialsOf(m.name)}</Text>
                </View>
                <View style={[st.presenceDot, { backgroundColor: pm.dot }]} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={st.name}>{m.name}</Text>
                <Text style={st.desig}>{m.designation} · {m.department}</Text>
                <View style={st.metaRow}>
                  <View style={[st.presChip, { backgroundColor: pm.chipBg }]}>
                    <Text style={[st.presChipTx, { color: pm.chipFg }]}>{pm.label}</Text>
                  </View>
                  {!!m.checkIn && m.presence !== 'leave' && m.presence !== 'out' && (
                    <Text style={st.checkIn}>🕐 {m.checkIn}</Text>
                  )}
                  {m.pending > 0 && (
                    <View style={st.pendingChip}><Text style={st.pendingTx}>{m.pending} pending</Text></View>
                  )}
                </View>
              </View>

              <View style={st.attBox}>
                <Text style={st.attNum}>{m.attendancePct}%</Text>
                <Text style={st.attLabel}>att.</Text>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' },
  presChip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  presChipTx: { fontSize: 10, fontWeight: '700' },
  checkIn: { fontSize: 11, color: T.faint },
  pendingChip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#FEF3C7' },
  pendingTx: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  attBox: { alignItems: 'center' },
  attNum: { fontSize: 16, fontWeight: '800', color: T.primary },
  attLabel: { fontSize: 10, color: T.faint },

  empty: { alignItems: 'center', paddingTop: 70, gap: 12 },
  emptyTx: { fontSize: 14, color: T.faint, fontWeight: '500' },
});
