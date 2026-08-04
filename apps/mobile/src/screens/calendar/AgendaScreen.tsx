import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchUpcoming } from '../../store/slices/calendarSlice';
import { useLivePolling } from '../../utils/useLivePolling';
import { UpcomingItem } from '../../types/calendar';
import { EmptyState, ModeBadge } from './components';
import { T, fmtDateShort, fmtTimeRange, isSameDay } from './calendarTheme';

function groupAgenda(items: UpcomingItem[]) {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + (7 - today.getDay())); weekEnd.setHours(23, 59, 59, 999);

  const buckets: { key: string; label: string; items: UpcomingItem[] }[] = [
    { key: 'today', label: 'Today', items: [] },
    { key: 'tomorrow', label: 'Tomorrow', items: [] },
    { key: 'week', label: 'This Week', items: [] },
    { key: 'later', label: 'Later', items: [] },
  ];
  for (const it of items) {
    const d = new Date(it.startDateTime);
    if (isSameDay(d, today)) buckets[0].items.push(it);
    else if (isSameDay(d, tomorrow)) buckets[1].items.push(it);
    else if (d <= weekEnd) buckets[2].items.push(it);
    else buckets[3].items.push(it);
  }
  return buckets.filter((b) => b.items.length > 0);
}

export default function AgendaScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { upcoming, loading, error } = useSelector((s: RootState) => s.calendar);

  const load = useCallback(() => { dispatch(fetchUpcoming()); }, [dispatch]);
  useLivePolling(load, 20_000);

  const groups = useMemo(() => groupAgenda(upcoming), [upcoming]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation?.canGoBack?.() && navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Team Calendar</Text>
        <View style={s.iconBtn} />
      </View>

      <View style={s.toggleRow}>
        <TouchableOpacity style={s.toggleChip} onPress={() => navigation?.navigate('TeamCalendar')} activeOpacity={0.85}>
          <Text style={s.toggleTx}>Month</Text>
        </TouchableOpacity>
        <View style={[s.toggleChip, s.toggleChipActive]}>
          <Text style={[s.toggleTx, s.toggleTxActive]}>Agenda</Text>
        </View>
      </View>

      {loading && !upcoming.length ? (
        <View style={s.center}><ActivityIndicator color={T.primary} size="large" /></View>
      ) : (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {!!error && !upcoming.length && (
            <View style={s.offline}><Text style={s.offlineTx}>{error}</Text></View>
          )}

          {groups.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No meetings today"
              subtitle="Nothing scheduled in the next 30 days."
              cta="Schedule Meeting"
              onPressCta={() => navigation?.navigate('CreateMeeting')}
            />
          ) : (
            groups.map((g) => (
              <View key={g.key} style={s.section}>
                <Text style={s.sectionTitle}>{g.label.toUpperCase()} · {g.items.length}</Text>
                <View style={s.card}>
                  {g.items.map((m, i) => (
                    <TouchableOpacity
                      key={`${m.eventId}-${m.startDateTime}`}
                      style={[s.row, i < g.items.length - 1 && s.rowBorder]}
                      activeOpacity={0.85}
                      onPress={() => navigation?.navigate('MeetingDetail', { eventId: m.eventId })}
                    >
                      <View style={s.dateChip}>
                        <Text style={s.dateChipDay}>{new Date(m.startDateTime).getDate()}</Text>
                        <Text style={s.dateChipMon}>{new Date(m.startDateTime).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowTitle} numberOfLines={1}>{m.title}</Text>
                        <Text style={s.rowSub}>{fmtTimeRange(m.startDateTime, m.endDateTime)} · {fmtDateShort(m.startDateTime)}</Text>
                      </View>
                      <ModeBadge mode={m.meetingMode} compact />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} activeOpacity={0.85} onPress={() => navigation?.navigate('CreateMeeting')}>
        <Text style={s.fabTx}>＋ Schedule Meeting</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  iconBtn: { width: 28 },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerTitle: { flex: 1, color: '#FFF', fontSize: 17, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  toggleChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: T.card },
  toggleChipActive: { backgroundColor: T.primary },
  toggleTx: { fontSize: 13, fontWeight: '700', color: T.sub },
  toggleTxActive: { color: '#FFF' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },

  offline: { backgroundColor: T.amber.bg, borderRadius: 10, padding: 10, marginBottom: 12 },
  offlineTx: { fontSize: 12, color: T.amber.fg, fontWeight: '600' },

  section: { marginTop: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: T.sub, letterSpacing: 0.8, marginBottom: 10 },
  card: {
    backgroundColor: T.card, borderRadius: 16, paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: T.line },
  dateChip: { width: 44, height: 48, borderRadius: 10, borderWidth: 1.5, borderColor: T.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFF' },
  dateChipDay: { fontSize: 16, fontWeight: '800', color: T.primary },
  dateChipMon: { fontSize: 9.5, fontWeight: '700', color: T.primary, letterSpacing: 0.4 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: T.ink },
  rowSub: { fontSize: 11.5, color: T.sub, marginTop: 2 },

  fab: {
    position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: T.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: T.primary, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  fabTx: { color: '#FFF', fontSize: 14.5, fontWeight: '800' },
});
