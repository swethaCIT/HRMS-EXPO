import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { projectApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import { Avatar, BoardHeader, EmptyState, OfflineNote, StatTile, StateChip, TypeBadge } from './components';
import { ColumnChart, ProgressBar } from './charts';
import { fmtDate, fmtHours, refOf, T, WorkItem } from './boardTheme';

const DAY_MS = 86_400_000;

/**
 * One person's contribution to a project — what they were given, what they
 * finished, and how much time they actually booked against it.
 */
export default function MemberReportScreen({ route, navigation }: any) {
  const projectId: string = route?.params?.projectId;
  const employeeId: string = route?.params?.employeeId;
  const name: string | undefined = route?.params?.name;
  const projectKey: string | undefined = route?.params?.projectKey;

  const [detail, setDetail] = useState<any>(null);
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!projectId || !employeeId) return;
    try {
      const [d, m] = await Promise.all([
        projectApi.memberDetail(projectId, employeeId),
        projectApi.memberReports(projectId),
      ]);
      setDetail(d.data);
      setRow((m.data?.members ?? []).find((x: any) => x.employeeId === employeeId) ?? null);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, [projectId, employeeId]);

  useLivePolling(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /** Hours booked per day over the last 14 days. */
  const daily = useMemo(() => {
    const logs = detail?.logs ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const values: number[] = [];
    const labels: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(today.getTime() - i * DAY_MS);
      const hours = logs
        .filter((l: any) => {
          const d = new Date(l.date);
          return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === day.getTime();
        })
        .reduce((s: number, l: any) => s + (l.hours || 0), 0);
      values.push(Math.round(hours * 10) / 10);
      labels.push(`${day.getDate()}`);
    }
    return { values, labels };
  }, [detail]);

  if (loading) {
    return (
      <View style={st.root}>
        <BoardHeader title={name || 'Member report'} navigation={navigation} />
        <View style={st.center}><ActivityIndicator size="large" color={T.primary} /></View>
      </View>
    );
  }

  const items: WorkItem[] = (detail?.items ?? []) as WorkItem[];

  return (
    <View style={st.root}>
      <BoardHeader
        title={name || row?.name || 'Member report'}
        subtitle={`${projectKey || 'Project'} · individual contribution`}
        navigation={navigation}
      />

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {offline && <OfflineNote />}

        {/* Identity */}
        <View style={st.hero}>
          <Avatar name={name || row?.name} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={st.heroName} numberOfLines={1}>{name || row?.name || 'Team member'}</Text>
            <Text style={st.heroSub} numberOfLines={1}>
              {row?.role || 'Contributor'}{row?.teamName ? ` · ${row.teamName}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={st.heroHours}>{fmtHours(detail?.hoursLogged ?? row?.hoursLogged)}</Text>
            <Text style={st.heroHoursLabel}>logged</Text>
          </View>
        </View>

        {!!row && (
          <>
            <View style={st.statRow}>
              <StatTile value={row.assigned} label="Assigned" />
              <StatTile value={row.closed} label="Closed" color="#10B981" />
              <StatTile value={row.active} label="Active" color="#2563EB" />
              <StatTile value={row.overdue} label="Overdue" color={row.overdue ? '#EF4444' : T.faint} />
            </View>

            <View style={st.card}>
              <Text style={st.cardTitle}>COMPLETION</Text>
              <Text style={st.cardSub}>{row.closed} of {row.assigned} assigned items finished</Text>
              <ProgressBar pct={row.completionPct} />
              <View style={st.statRow}>
                <StatTile value={`${row.completionPct}%`} label="Completion" color="#10B981" />
                <StatTile value={`${row.onTimePct}%`} label="On time" color="#0EA5E9" />
                <StatTile value={row.avgCycleDays} label="Avg cycle (d)" color="#7C3AED" />
                <StatTile value={row.storyPoints} label="Points done" color="#F59E0B" />
              </View>
            </View>

            <View style={st.card}>
              <Text style={st.cardTitle}>TIME & ESTIMATION</Text>
              <Text style={st.cardSub}>How much they put in versus what was planned</Text>
              <View style={st.statRow}>
                <StatTile value={fmtHours(row.estimated)} label="Estimated" />
                <StatTile value={fmtHours(row.actual)} label="Booked" color="#10B981" />
                <StatTile value={fmtHours(row.remaining)} label="Remaining" color="#F59E0B" />
                <StatTile value={`${row.effortSharePct}%`} label="Of project" color="#0EA5E9" />
              </View>
              <Text style={st.foot}>
                Engaged on {row.daysEngaged} day{row.daysEngaged === 1 ? '' : 's'} · {row.avgHoursPerDay}h per active day
                {row.estimateAccuracyPct
                  ? row.estimateAccuracyPct > 100
                    ? ` · running ${row.estimateAccuracyPct - 100}% over estimate`
                    : ` · at ${row.estimateAccuracyPct}% of estimate`
                  : ''}
              </Text>
            </View>
          </>
        )}

        {/* Daily effort */}
        <View style={st.card}>
          <Text style={st.cardTitle}>HOURS PER DAY</Text>
          <Text style={st.cardSub}>Last 14 days</Text>
          <ColumnChart values={daily.values} labels={daily.labels} />
        </View>

        {/* Assigned items */}
        <Text style={st.sectionTitle}>ASSIGNED WORK · {items.length}</Text>
        {items.length === 0 ? (
          <View style={st.card}><Text style={st.muted}>Nothing assigned on this project.</Text></View>
        ) : (
          items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={st.itemRow}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('WorkItemDetail', { id: item.id, projectKey })}
            >
              <View style={st.itemTop}>
                <TypeBadge type={item.type} compact />
                <Text style={st.itemRef}>{refOf(projectKey, item.seq)}</Text>
                <View style={{ flex: 1 }} />
                <StateChip state={item.state} />
              </View>
              <Text style={st.itemTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={st.itemFootTx}>
                {fmtHours(item.completedWork)} booked · {fmtHours(item.remainingWork)} left · due {fmtDate(item.targetDate)}
              </Text>
            </TouchableOpacity>
          ))
        )}

        {/* Time entries */}
        {!!detail?.logs?.length && (
          <>
            <Text style={st.sectionTitle}>TIME ENTRIES · {detail.logs.length}</Text>
            <View style={st.card}>
              {detail.logs.map((l: any, i: number) => (
                <View key={l.id} style={[st.logRow, i < detail.logs.length - 1 && st.divider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.logTitle} numberOfLines={1}>{l.workItemTitle || 'Work item'}</Text>
                    <Text style={st.logNote} numberOfLines={1}>{l.note || 'No note'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.logHours}>{fmtHours(l.hours)}</Text>
                    <Text style={st.logDate}>{fmtDate(l.date)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {!row && !detail && <EmptyState icon="user" title="No report yet" subtitle="Pull down to try again." />}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 12.5, color: T.sub },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.headerAlt,
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  heroName: { fontSize: 16.5, fontWeight: '800', color: '#FFF' },
  heroSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  heroHours: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  heroHoursLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)' },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 10, marginTop: 12 },

  card: {
    backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardTitle: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.8 },
  cardSub: { fontSize: 11.5, color: T.faint, marginTop: 2, marginBottom: 12 },
  foot: { fontSize: 11, color: T.sub, marginTop: 10, lineHeight: 16 },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#374151', letterSpacing: 0.8, marginBottom: 10, marginTop: 2 },
  itemRow: {
    backgroundColor: T.card, borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemRef: { fontSize: 10.5, fontWeight: '700', color: T.faint },
  itemTitle: { fontSize: 13, fontWeight: '700', color: T.ink, marginTop: 8, lineHeight: 18 },
  itemFootTx: { fontSize: 11, color: T.sub, marginTop: 7 },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  logTitle: { fontSize: 12.5, fontWeight: '700', color: T.ink },
  logNote: { fontSize: 11, color: T.sub, marginTop: 2 },
  logHours: { fontSize: 13, fontWeight: '800', color: T.primary },
  logDate: { fontSize: 10.5, color: T.faint, marginTop: 2 },
});
