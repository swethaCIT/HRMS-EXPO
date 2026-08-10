import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Linking,
} from 'react-native';
import {
  T, TEAM, PRESENCE_META, initialsOf, avatarColor, TeamMember,
} from '../../data/managerData';


export default function TeamMemberDetailScreen({ route, navigation }: any) {
  // Accept either a full member object (People / Team) or an id to look up.
  const id = route?.params?.id;
  // No `?? TEAM[0]` fallback: navigating with an unknown id used to render a
  // mock person as though they were real, so you could hold a review
  // conversation about someone else's numbers. Show an honest empty state.
  const m: TeamMember | undefined = route?.params?.member ?? TEAM.find((x) => x.id === id);

  if (!m) {
    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor={T.header} />
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} style={st.back}>
            <Text style={st.backTx}>‹</Text>
          </TouchableOpacity>
          <Text style={st.hTitle}>Team member</Text>
        </View>
        <View style={st.notFound}>
          <Text style={{ fontSize: 40 }}>🔍</Text>
          <Text style={st.notFoundTx}>That team member could not be found.</Text>
          <TouchableOpacity style={st.notFoundBtn} onPress={() => navigation?.goBack?.()}>
            <Text style={st.notFoundBtnTx}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const pm = PRESENCE_META[m.presence];

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()} style={st.back}>
          <Text style={st.backTx}>‹</Text>
        </TouchableOpacity>

        <View style={st.profile}>
          <View style={{ position: 'relative' }}>
            <View style={[st.avatar, { backgroundColor: avatarColor(m.name) }]}>
              <Text style={st.avatarTx}>{initialsOf(m.name)}</Text>
            </View>
            <View style={[st.presenceDot, { backgroundColor: pm.dot }]} />
          </View>
          <Text style={st.name}>{m.name}</Text>
          <Text style={st.desig}>{m.designation} · {m.department}</Text>
          <View style={[st.presChip, { backgroundColor: pm.chipBg }]}>
            <Text style={[st.presChipTx, { color: pm.chipFg }]}>● {pm.label}{m.checkIn && m.presence !== 'leave' && m.presence !== 'out' ? ` since ${m.checkIn}` : ''}</Text>
          </View>
        </View>

        <View style={st.contactRow}>
          <TouchableOpacity style={st.contactBtn} onPress={() => Linking.openURL(`tel:${m.phone.replace(/\s/g, '')}`)}>
            <Text style={st.contactEmoji}>📞</Text><Text style={st.contactTx}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.contactBtn} onPress={() => Linking.openURL(`mailto:${m.email}`)}>
            <Text style={st.contactEmoji}>✉️</Text><Text style={st.contactTx}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.contactBtn} onPress={() => navigation?.navigate('Approvals')}>
            <Text style={st.contactEmoji}>✅</Text><Text style={st.contactTx}>Approvals</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* Attendance %, utilization and review scores are not tracked by the
            API. They used to render here as three confident rings fed by
            `90 + (i % 9)` / `75 + (i % 20)` / `80 + (i % 18)` — invented from
            the person's row index and shown as their performance. Removed
            rather than faked; today's real presence is in the header chip. */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Performance Snapshot</Text>
          <Text style={st.notTracked}>
            Attendance rate, utilization and review scores aren't tracked yet, so there's nothing to show here.
          </Text>
        </View>

        {/* quick facts */}
        <View style={st.statGrid}>
          {[
            { e: '🆔', l: 'Employee ID', v: m.employeeId },
            { e: '📅', l: 'Leave balance', v: m.leaveBalance != null ? `${m.leaveBalance} days` : '—' },
            { e: '🗂️', l: 'Open requests', v: `${m.pending}` },
            { e: '📞', l: 'Phone', v: m.phone },
          ].map((s) => (
            <View key={s.l} style={st.statCard}>
              <Text style={st.statEmoji}>{s.e}</Text>
              <Text style={st.statVal}>{s.v}</Text>
              <Text style={st.statLabel}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* projects */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Current Projects</Text>
          <View style={st.tagWrap}>
            {m.projects.map((p) => (
              <View key={p} style={st.projTag}><Text style={st.projTagTx}>{p}</Text></View>
            ))}
          </View>
        </View>

        {/* this week mini-attendance */}
        <View style={st.card}>
          <Text style={st.cardTitle}>This Week</Text>
          <View style={st.weekRow}>
            {/* Was `(m.attendancePct + i * 3) % 7 !== 0` — a fake pattern from a
                fake number. Until per-day history is exposed, only today is
                known, so the other days render as unknown. */}
            {['M', 'T', 'W', 'T', 'F'].map((d, i) => {
              const isToday = new Date().getDay() === i + 1;
              const present = isToday && (m.presence === 'in' || m.presence === 'remote');
              return (
                <View key={i} style={st.dayCol}>
                  <View style={[st.dayDot, { backgroundColor: present ? '#10B981' : '#E5E7EB' }]} />
                  <Text style={st.dayLabel}>{d}</Text>
                </View>
              );
            })}
            <View style={st.dayCol}>
              <View style={[st.dayDot, { backgroundColor: m.presence === 'leave' ? '#F59E0B' : '#4F46E5' }]} />
              <Text style={[st.dayLabel, { color: T.primary, fontWeight: '700' }]}>Now</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backTx: { color: '#FFF', fontSize: 26, fontWeight: '700', marginTop: -4 },
  hTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginTop: 10 },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  notFoundTx: { fontSize: 14, color: T.sub, textAlign: 'center' },
  notFoundBtn: { backgroundColor: T.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  notFoundBtnTx: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  profile: { alignItems: 'center', marginTop: 4 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  avatarTx: { color: '#FFF', fontWeight: '800', fontSize: 26 },
  presenceDot: { position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: T.header },
  name: { fontSize: 20, fontWeight: '700', color: '#FFF', marginTop: 12 },
  desig: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  presChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  presChipTx: { fontSize: 11.5, fontWeight: '700' },

  contactRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 11 },
  contactEmoji: { fontSize: 14 },
  contactTx: { color: '#FFF', fontWeight: '600', fontSize: 13 },

  body: { flex: 1 },
  card: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  notTracked: { fontSize: 12.5, color: '#9CA3AF', lineHeight: 18, marginTop: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: T.ink, marginBottom: 16 },
  ringRow: { flexDirection: 'row', justifyContent: 'space-around' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: { width: '47%', flexGrow: 1, backgroundColor: T.card, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  statEmoji: { fontSize: 18, marginBottom: 8 },
  statVal: { fontSize: 15, fontWeight: '800', color: T.ink },
  statLabel: { fontSize: 11, color: T.sub, marginTop: 2 },

  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  projTag: { backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  projTagTx: { color: T.primary, fontWeight: '700', fontSize: 12 },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 8 },
  dayDot: { width: 14, height: 14, borderRadius: 7 },
  dayLabel: { fontSize: 11, color: T.sub, fontWeight: '600' },
});
