import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { workItemApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import { BoardHeader, EmptyState, OfflineNote, PriorityChip, StateChip, StatTile, TypeBadge } from './components';
import { ProgressBar } from './charts';
import { BOARD_COLUMNS, fmtDate, fmtHours, isOverdue, STATE_META, T, WorkItemState } from './boardTheme';

type Filter = 'open' | WorkItemState;

/** Everything assigned to the signed-in user, across every project board. */
export default function MyWorkItemsScreen({ navigation }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await workItemApi.mine();
      setItems(data?.items ?? []);
      setStats(data?.stats ?? null);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, []);

  useLivePolling(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visible = useMemo(
    () => (filter === 'open' ? items.filter((i) => i.state !== 'closed') : items.filter((i) => i.state === filter)),
    [items, filter],
  );

  const overdue = items.filter((i) => isOverdue(i)).length;

  return (
    <View style={st.root}>
      <BoardHeader title="My work items" subtitle="Assigned to you across all boards" navigation={navigation} />

      <View style={st.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
          {(['open', ...BOARD_COLUMNS] as Filter[]).map((f) => {
            const on = filter === f;
            const label = f === 'open' ? 'Open' : STATE_META[f as WorkItemState].label;
            const count = f === 'open' ? items.filter((i) => i.state !== 'closed').length : items.filter((i) => i.state === f).length;
            return (
              <TouchableOpacity key={f} style={[st.chip, on && st.chipOn]} onPress={() => setFilter(f)} activeOpacity={0.85}>
                <Text style={[st.chipTx, on && st.chipTxOn]}>{label} {count}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator size="large" color={T.primary} /></View>
      ) : (
        <ScrollView
          style={st.body}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
        >
          {offline && <OfflineNote />}

          {!!stats && (
            <View style={st.statRow}>
              <StatTile value={stats.total} label="Assigned" />
              <StatTile value={stats.active} label="Active" color="#2563EB" />
              <StatTile value={stats.closed} label="Closed" color="#10B981" />
              <StatTile value={overdue} label="Overdue" color={overdue ? '#EF4444' : T.faint} />
            </View>
          )}

          {visible.length === 0 ? (
            <EmptyState icon="check-square" title="Nothing here" subtitle="No work items match this filter." />
          ) : (
            visible.map((item) => {
              const total = item.originalEstimate || item.completedWork + item.remainingWork;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={st.card}
                  activeOpacity={0.85}
                  onPress={() => navigation?.navigate('WorkItemDetail', { id: item.id })}
                >
                  <View style={st.cardTop}>
                    <TypeBadge type={item.type} compact />
                    <Text style={st.ref}>{item.ref}</Text>
                    <View style={{ flex: 1 }} />
                    <PriorityChip priority={item.priority} />
                    <StateChip state={item.state} />
                  </View>
                  <Text style={st.title} numberOfLines={2}>{item.title}</Text>
                  <Text style={st.project} numberOfLines={1}>{item.projectName}</Text>
                  {total > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <ProgressBar pct={(item.completedWork / total) * 100} height={6} />
                    </View>
                  )}
                  <View style={st.foot}>
                    <Text style={st.footTx}>{fmtHours(item.completedWork)} of {fmtHours(total)}</Text>
                    <Text style={[st.footTx, isOverdue(item) && { color: '#991B1B', fontWeight: '800' }]}>
                      Due {fmtDate(item.targetDate)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  filterBar: { paddingVertical: 10, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line },
  chip: { backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 7 },
  chipOn: { backgroundColor: T.primary },
  chipTx: { fontSize: 12, fontWeight: '700', color: T.sub },
  chipTxOn: { color: '#FFF' },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  card: {
    backgroundColor: T.card, borderRadius: 14, padding: 13, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ref: { fontSize: 10.5, fontWeight: '700', color: T.faint },
  title: { fontSize: 13.5, fontWeight: '700', color: T.ink, marginTop: 8, lineHeight: 19 },
  project: { fontSize: 11, color: T.sub, marginTop: 3 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  footTx: { fontSize: 11, color: T.sub, fontWeight: '600' },
});
