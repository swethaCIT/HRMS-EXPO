import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { sprintApi, workItemApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import { Avatar, BoardHeader, EmptyState, OfflineNote, StatTile, StateChip, TypeBadge } from './components';
import { Burndown, ColumnChart, ProgressBar, StateBar } from './charts';
import { fmtDate, fmtHours, refOf, STATE_META, T, WorkItem } from './boardTheme';

/**
 * Sprint analysis — burndown against the ideal line, daily effort logged, the
 * state mix and per-person load for the iteration.
 */
export default function SprintDetailScreen({ route, navigation }: any) {
  const sprintId: string = route?.params?.sprintId;
  const projectKey: string | undefined = route?.params?.projectKey;

  const [burn, setBurn] = useState<any>(null);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!sprintId) return;
    try {
      const { data } = await sprintApi.burndown(sprintId);
      setBurn(data);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    try {
      const { data } = await workItemApi.list({ sprintId });
      setItems(Array.isArray(data) ? data.filter((i: WorkItem) => i.state !== 'removed') : []);
    } catch { /* burndown alone is still useful */ }
    setLoading(false);
  }, [sprintId]);

  useLivePolling(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /** Per-person load inside the sprint — who is carrying what. */
  const byPerson = useMemo(() => {
    const map = new Map<string, { name: string; total: number; closed: number; remaining: number }>();
    for (const i of items) {
      const key = i.assigneeId || 'unassigned';
      const row = map.get(key) ?? { name: i.assigneeName || 'Unassigned', total: 0, closed: 0, remaining: 0 };
      row.total += 1;
      if (i.state === 'closed') row.closed += 1;
      row.remaining += i.remainingWork || 0;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.remaining - a.remaining || b.total - a.total);
  }, [items]);

  if (loading) {
    return (
      <View style={st.root}>
        <BoardHeader title="Sprint" navigation={navigation} />
        <View style={st.center}><ActivityIndicator size="large" color={T.primary} /></View>
      </View>
    );
  }

  if (!burn) {
    return (
      <View style={st.root}>
        <BoardHeader title="Sprint" navigation={navigation} />
        <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {offline && <OfflineNote />}
          <EmptyState icon="calendar" title="Sprint unavailable" subtitle="Pull down to try again." />
        </ScrollView>
      </View>
    );
  }

  const sprint = burn.sprint;
  const behind = burn.variance < 0;
  const unitLabel = burn.unit === 'hours' ? 'hours' : burn.unit === 'points' ? 'points' : 'items';
  const segments = [
    { value: burn.itemsNew, color: STATE_META.new.solid },
    { value: burn.itemsActive, color: STATE_META.active.solid },
    { value: burn.itemsResolved, color: STATE_META.resolved.solid },
    { value: burn.itemsClosed, color: STATE_META.closed.solid },
  ];

  return (
    <View style={st.root}>
      <BoardHeader
        title={sprint.name}
        subtitle={`${fmtDate(sprint.startDate)} → ${fmtDate(sprint.endDate)}`}
        navigation={navigation}
      />

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {offline && <OfflineNote />}

        {!!sprint.goal && (
          <View style={st.goalCard}>
            <Text style={st.goalLabel}>SPRINT GOAL</Text>
            <Text style={st.goalTx}>{sprint.goal}</Text>
          </View>
        )}

        {/* Burndown */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>BURNDOWN</Text>
              <Text style={st.cardSub}>Remaining {unitLabel} vs the ideal trend</Text>
            </View>
            <View style={[st.varChip, { backgroundColor: behind ? T.red.bg : T.green.bg }]}>
              <Text style={[st.varChipTx, { color: behind ? T.red.fg : T.green.fg }]}>
                {behind ? `▼ ${Math.abs(burn.variance)} behind` : `▲ ${burn.variance} ahead`}
              </Text>
            </View>
          </View>
          <Burndown labels={burn.labels} ideal={burn.ideal} actual={burn.actual} />
          <View style={st.statRow}>
            <StatTile value={burn.total} label={`Committed ${unitLabel}`} />
            <StatTile value={burn.currentRemaining} label="Remaining" color="#F59E0B" />
            <StatTile value={`${burn.daysElapsed}/${burn.daysTotal}`} label="Days" color="#0EA5E9" />
            <StatTile value={burn.daysLeft} label="Days left" color={burn.daysLeft <= 2 ? '#EF4444' : '#10B981'} />
          </View>
        </View>

        {/* Daily effort */}
        <View style={st.card}>
          <Text style={st.cardTitle}>EFFORT LOGGED PER DAY</Text>
          <Text style={st.cardSub}>{fmtHours(burn.hoursLogged)} booked across the sprint</Text>
          <ColumnChart values={burn.loggedPerDay} labels={burn.labels} />
        </View>

        {/* Progress + state mix */}
        <View style={st.card}>
          <Text style={st.cardTitle}>SPRINT PROGRESS</Text>
          <Text style={st.cardSub}>
            {burn.itemsClosed} of {burn.itemsTotal} items closed · {burn.pointsClosed}/{burn.pointsTotal} points
          </Text>
          <StateBar segments={segments} />
          <View style={st.legendGrid}>
            {(['new', 'active', 'resolved', 'closed'] as const).map((s) => (
              <View key={s} style={st.legendCell}>
                <View style={[st.legendDot, { backgroundColor: STATE_META[s].solid }]} />
                <Text style={st.legendLabel}>{STATE_META[s].label}</Text>
                <Text style={st.legendVal}>
                  {s === 'new' ? burn.itemsNew : s === 'active' ? burn.itemsActive : s === 'resolved' ? burn.itemsResolved : burn.itemsClosed}
                </Text>
              </View>
            ))}
          </View>
          <View style={st.statRow}>
            <StatTile value={fmtHours(burn.estimated)} label="Estimated" />
            <StatTile value={fmtHours(burn.completed)} label="Completed" color="#10B981" />
            <StatTile value={fmtHours(burn.remaining)} label="Remaining" color="#F59E0B" />
          </View>
        </View>

        {/* Load per person */}
        {byPerson.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>LOAD BY PERSON</Text>
            <Text style={st.cardSub}>Items carried in this iteration</Text>
            {byPerson.map((p, i) => (
              <View key={`${p.name}-${i}`} style={st.personRow}>
                <Avatar name={p.name === 'Unassigned' ? undefined : p.name} size={30} />
                <View style={{ flex: 1 }}>
                  <Text style={st.personName} numberOfLines={1}>{p.name}</Text>
                  <View style={{ marginTop: 5 }}>
                    <ProgressBar pct={p.total ? (p.closed / p.total) * 100 : 0} height={5} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.personVal}>{p.closed}/{p.total}</Text>
                  <Text style={st.personSub}>{fmtHours(p.remaining)} left</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Sprint backlog */}
        <Text style={st.sectionTitle}>SPRINT BACKLOG · {items.length}</Text>
        {items.length === 0 ? (
          <View style={st.card}><Text style={st.muted}>No work items in this iteration yet.</Text></View>
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
              <View style={st.itemFoot}>
                <Avatar name={item.assigneeName} size={22} />
                <Text style={st.itemFootTx} numberOfLines={1}>{item.assigneeName || 'Unassigned'}</Text>
                <View style={{ flex: 1 }} />
                {item.storyPoints > 0 && <Text style={st.itemFootTx}>{item.storyPoints} pts</Text>}
                <Text style={st.itemFootTx}>{fmtHours(item.remainingWork)} left</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 12.5, color: T.sub },

  goalCard: { backgroundColor: T.headerAlt, borderRadius: 14, padding: 14, marginBottom: 14 },
  goalLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.65)', letterSpacing: 0.8 },
  goalTx: { fontSize: 13.5, color: '#FFF', fontWeight: '600', marginTop: 5, lineHeight: 19 },

  card: {
    backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.8 },
  cardSub: { fontSize: 11.5, color: T.faint, marginTop: 2, marginBottom: 12 },
  varChip: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  varChipTx: { fontSize: 10.5, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 14 },

  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  legendCell: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 12, color: T.sub },
  legendVal: { fontSize: 13, fontWeight: '800', color: T.ink, marginRight: 12 },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  personName: { fontSize: 13, fontWeight: '700', color: T.ink },
  personVal: { fontSize: 13, fontWeight: '800', color: T.ink },
  personSub: { fontSize: 10.5, color: T.sub, marginTop: 2 },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#374151', letterSpacing: 0.8, marginBottom: 10, marginTop: 2 },
  itemRow: {
    backgroundColor: T.card, borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemRef: { fontSize: 10.5, fontWeight: '700', color: T.faint },
  itemTitle: { fontSize: 13, fontWeight: '700', color: T.ink, marginTop: 8, lineHeight: 18 },
  itemFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  itemFootTx: { fontSize: 11, color: T.sub, fontWeight: '600' },
});
