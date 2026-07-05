import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { T } from '../../data/managerData';
import { holidayApi } from '../../services/api';
import Icon from '../../components/Icon';

/* ── Types ── */
type HolidayType = 'public' | 'optional' | 'company';
interface Holiday {
  id: string;
  date: string;            // YYYY-MM-DD
  name: string;
  type: HolidayType;
  description?: string;
}

/* ── Type badge palette (public = indigo, optional = amber, company = green) ── */
const TYPE_META: Record<HolidayType, { label: string; bg: string; fg: string; solid: string }> = {
  public:   { label: 'Public',   bg: '#EEF2FF', fg: T.primary,   solid: T.primary },
  optional: { label: 'Optional', bg: T.amber.bg, fg: T.amber.fg, solid: T.amber.solid },
  company:  { label: 'Company',  bg: T.green.bg, fg: T.green.fg, solid: T.green.solid },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parse a YYYY-MM-DD string into a local Date at midnight (avoids UTC drift). */
function parseDate(iso: string): Date {
  const [y, m, d] = (iso || '').split('-').map((n) => parseInt(n, 10));
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}
function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function daysUntil(iso: string): number {
  const ms = parseDate(iso).getTime() - startOfToday().getTime();
  return Math.round(ms / 86400000);
}

export default function HolidaysScreen({ navigation }: any) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await holidayApi.list();
      if (Array.isArray(data)) setHolidays(data as Holiday[]);
    } catch { /* keep whatever we have */ }
  }, []);

  useEffect(() => {
    (async () => { await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const { upcoming, past, next } = useMemo(() => {
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    const up: Holiday[] = [];
    const pa: Holiday[] = [];
    for (const h of sorted) {
      if (daysUntil(h.date) >= 0) up.push(h); else pa.push(h);
    }
    pa.reverse(); // most recent past first
    return { upcoming: up, past: pa, next: up[0] || null };
  }, [holidays]);

  const renderRow = (h: Holiday, faded = false, isLast = false) => {
    const d = parseDate(h.date);
    const meta = TYPE_META[h.type] || TYPE_META.public;
    return (
      <View key={h.id} style={[st.row, isLast && st.rowLast, faded && st.rowFaded]}>
        <View style={[st.dateChip, { borderColor: meta.solid }]}>
          <Text style={[st.dateDay, { color: meta.fg }]}>{d.getDate()}</Text>
          <Text style={[st.dateMon, { color: meta.fg }]}>{MONTHS[d.getMonth()]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.rowName} numberOfLines={2}>{h.name}</Text>
          <Text style={st.rowSub}>{WEEKDAYS[d.getDay()]}{h.description ? ` · ${h.description}` : ''}</Text>
        </View>
        <View style={[st.badge, { backgroundColor: meta.bg }]}>
          <Text style={[st.badgeTx, { color: meta.fg }]}>{meta.label}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      {/* ── Header ── */}
      <View style={st.header}>
        <TouchableOpacity
          style={st.iconBtn}
          onPress={() => navigation?.canGoBack?.() && navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={st.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Holidays</Text>
        <View style={st.iconBtn} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={T.primary} size="large" /></View>
      ) : (
        <ScrollView
          style={st.body}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
        >
          {holidays.length === 0 ? (
            <View style={st.empty}>
              <Icon name="calendar" size={40} color={T.faint} />
              <Text style={st.emptyTx}>No holidays published yet</Text>
              <Text style={st.emptySub}>Pull down to refresh once HR adds the calendar.</Text>
            </View>
          ) : (
            <>
              {/* ── Next holiday highlight ── */}
              {next && (() => {
                const d = parseDate(next.date);
                const meta = TYPE_META[next.type] || TYPE_META.public;
                const inDays = daysUntil(next.date);
                const when = inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `In ${inDays} days`;
                return (
                  <View style={st.nextCard}>
                    <View style={st.nextTopRow}>
                      <Text style={st.nextLabel}>NEXT HOLIDAY</Text>
                      <View style={st.nextPill}><Text style={st.nextPillTx}>{when}</Text></View>
                    </View>
                    <Text style={st.nextName}>{next.name}</Text>
                    <Text style={st.nextDate}>
                      {WEEKDAYS[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()]} {d.getFullYear()}
                    </Text>
                    <View style={[st.nextBadge, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
                      <Text style={st.nextBadgeTx}>{meta.label} holiday</Text>
                    </View>
                  </View>
                );
              })()}

              {/* ── Upcoming ── */}
              {upcoming.length > 0 && (
                <View style={st.section}>
                  <Text style={st.sectionTitle}>UPCOMING · {upcoming.length}</Text>
                  <View style={st.card}>{upcoming.map((h, i) => renderRow(h, false, i === upcoming.length - 1))}</View>
                </View>
              )}

              {/* ── Past ── */}
              {past.length > 0 && (
                <View style={[st.section, { marginBottom: 4 }]}>
                  <Text style={st.sectionTitle}>EARLIER THIS YEAR · {past.length}</Text>
                  <View style={st.card}>{past.map((h, i) => renderRow(h, true, i === past.length - 1))}</View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: {
    backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  iconBtn: { width: 32, alignItems: 'flex-start' },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 18, fontWeight: '700' },

  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* next holiday highlight */
  nextCard: {
    backgroundColor: T.headerAlt, borderRadius: 18, padding: 18, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  nextTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  nextLabel: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  nextPill: { backgroundColor: T.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  nextPillTx: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  nextName: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  nextDate: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  nextBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12 },
  nextBadgeTx: { fontSize: 11, fontWeight: '700', color: '#FFF' },

  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.8, marginBottom: 12 },

  card: {
    backgroundColor: T.card, borderRadius: 16, paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowFaded: { opacity: 0.55 },
  dateChip: {
    width: 48, height: 52, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFF',
  },
  dateDay: { fontSize: 18, fontWeight: '800' },
  dateMon: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowName: { fontSize: 14.5, fontWeight: '700', color: T.ink },
  rowSub: { fontSize: 12, color: T.sub, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeTx: { fontSize: 10.5, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 90, gap: 10 },
  emptyTx: { fontSize: 15, color: T.ink, fontWeight: '700' },
  emptySub: { fontSize: 12.5, color: T.faint, textAlign: 'center', paddingHorizontal: 40 },
});
