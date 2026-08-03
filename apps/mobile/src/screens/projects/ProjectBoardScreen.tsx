import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Dimensions,
} from 'react-native';
import { projectApi, workItemApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import { getErrorMessage } from '../../utils/errorMessage';
import { Avatar, BoardHeader, OfflineNote, PriorityChip, TypeBadge } from './components';
import {
  BOARD_COLUMNS, fmtHours, isOverdue, nextStates, refOf, STATE_META, T, TYPE_META, WorkItem, WorkItemState,
} from './boardTheme';

const { width } = Dimensions.get('window');
const COL_W = Math.min(300, width * 0.8);

/**
 * Kanban board — one column per workflow state (New → Active → Resolved →
 * Closed). Tapping the arrow on a card moves it to the next valid state, which
 * writes straight through to the API.
 */
export default function ProjectBoardScreen({ route, navigation }: any) {
  const projectId: string = route?.params?.projectId;
  const projectKey: string = route?.params?.projectKey;

  const [items, setItems] = useState<WorkItem[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);
  const [hideParents, setHideParents] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);

  // Sprint list is fetched once and seeds the filter with the running sprint —
  // that's the board people mean when they say "the board". Kept out of the
  // polling loop so it can never fight the user's own filter choice.
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const { data } = await projectApi.sprints(projectId);
        if (Array.isArray(data)) {
          setSprints(data);
          setSprintFilter(data.find((s: any) => s.status === 'current')?.id ?? null);
        }
      } catch { /* the board still works without the filter bar */ }
    })();
  }, [projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const { data } = await workItemApi.list({ projectId, sprintId: sprintFilter || undefined });
      setItems(Array.isArray(data) ? data : []);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, [projectId, sprintFilter]);

  useLivePolling(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visible = useMemo(() => {
    const live = items.filter((i) => i.state !== 'removed');
    // A board is about deliverable work — epics/features are containers.
    return hideParents ? live.filter((i) => i.type === 'user_story' || i.type === 'task' || i.type === 'bug') : live;
  }, [items, hideParents]);

  const move = (item: WorkItem) => {
    const options = nextStates(item.state);
    if (!options.length) return;
    Alert.alert(
      `${refOf(projectKey, item.seq)}`,
      `Move “${item.title}” from ${STATE_META[item.state].label} to:`,
      [
        ...options.map((s) => ({
          text: STATE_META[s].label,
          onPress: async () => {
            setMoving(item.id);
            // Optimistic: the card jumps columns immediately, then reconciles.
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, state: s } : i)));
            try {
              await workItemApi.setState(item.id, s);
              await load();
            } catch (err) {
              Alert.alert('Could not move item', getErrorMessage(err));
              await load();
            } finally {
              setMoving(null);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  return (
    <View style={st.root}>
      <BoardHeader
        title="Board"
        subtitle={`${projectKey || 'Project'} · ${visible.length} item${visible.length === 1 ? '' : 's'}`}
        navigation={navigation}
      />

      <View style={st.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
          <TouchableOpacity style={[st.chip, !sprintFilter && st.chipOn]} onPress={() => setSprintFilter(null)} activeOpacity={0.8}>
            <Text style={[st.chipTx, !sprintFilter && st.chipTxOn]}>All items</Text>
          </TouchableOpacity>
          {sprints.map((s) => {
            const on = sprintFilter === s.id;
            return (
              <TouchableOpacity key={s.id} style={[st.chip, on && st.chipOn]} onPress={() => setSprintFilter(s.id)} activeOpacity={0.8}>
                <Text style={[st.chipTx, on && st.chipTxOn]}>{s.name}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[st.chip, !hideParents && st.chipOn]} onPress={() => setHideParents((v) => !v)} activeOpacity={0.8}>
            <Text style={[st.chipTx, !hideParents && st.chipTxOn]}>{hideParents ? 'Show epics' : 'Hide epics'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator size="large" color={T.primary} /></View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={st.board}
          contentContainerStyle={{ padding: 12, gap: 12 }}
        >
          {BOARD_COLUMNS.map((col) => {
            const colItems = visible.filter((i) => i.state === col);
            const meta = STATE_META[col];
            const points = colItems.reduce((s, i) => s + (i.storyPoints || 0), 0);
            return (
              <View key={col} style={[st.column, { width: COL_W }]}>
                <View style={st.colHead}>
                  <View style={[st.colDot, { backgroundColor: meta.solid }]} />
                  <Text style={st.colTitle}>{meta.label}</Text>
                  <View style={[st.colCount, { backgroundColor: meta.bg }]}>
                    <Text style={[st.colCountTx, { color: meta.fg }]}>{colItems.length}</Text>
                  </View>
                </View>
                {points > 0 && <Text style={st.colSub}>{points} points</Text>}

                <ScrollView
                  style={st.colBody}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20, gap: 8 }}
                  refreshControl={
                    col === 'new' ? (
                      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />
                    ) : undefined
                  }
                >
                  {colItems.length === 0 ? (
                    <View style={st.colEmpty}><Text style={st.colEmptyTx}>Nothing here</Text></View>
                  ) : (
                    colItems.map((item) => {
                      const tmeta = TYPE_META[item.type];
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[st.card, { borderTopColor: tmeta.solid }]}
                          activeOpacity={0.85}
                          onPress={() => navigation?.navigate('WorkItemDetail', { id: item.id, projectKey })}
                        >
                          <View style={st.cardTop}>
                            <TypeBadge type={item.type} compact />
                            <Text style={st.ref}>{refOf(projectKey, item.seq)}</Text>
                            <View style={{ flex: 1 }} />
                            <PriorityChip priority={item.priority} />
                          </View>

                          <Text style={st.cardTitle} numberOfLines={3}>{item.title}</Text>

                          <View style={st.cardFoot}>
                            <Avatar name={item.assigneeName} size={24} />
                            <View style={{ flex: 1 }}>
                              <Text style={st.assignee} numberOfLines={1}>{item.assigneeName || 'Unassigned'}</Text>
                              {item.originalEstimate > 0 && (
                                <Text style={st.effort}>
                                  {fmtHours(item.remainingWork)} left of {fmtHours(item.originalEstimate)}
                                </Text>
                              )}
                            </View>
                            {nextStates(item.state).length > 0 && (
                              <TouchableOpacity
                                style={st.moveBtn}
                                onPress={() => move(item)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                disabled={moving === item.id}
                              >
                                {moving === item.id ? (
                                  <ActivityIndicator size="small" color={T.primary} />
                                ) : (
                                  <Text style={st.moveTx}>→</Text>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>

                          {isOverdue(item) && (
                            <View style={st.lateStrip}><Text style={st.lateTx}>Past target date</Text></View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}

      {offline && <View style={st.offlineWrap}><OfflineNote /></View>}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  board: { flex: 1 },

  filterBar: { paddingVertical: 10, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line },
  chip: { backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 7 },
  chipOn: { backgroundColor: T.primary },
  chipTx: { fontSize: 12, fontWeight: '700', color: T.sub },
  chipTxOn: { color: '#FFF' },

  column: { backgroundColor: '#EDEEF2', borderRadius: 14, padding: 10 },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  colDot: { width: 9, height: 9, borderRadius: 4.5 },
  colTitle: { fontSize: 13, fontWeight: '800', color: T.ink, letterSpacing: 0.3 },
  colCount: { borderRadius: 10, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
  colCountTx: { fontSize: 11, fontWeight: '800' },
  colSub: { fontSize: 10.5, color: T.sub, marginTop: 3, marginLeft: 16 },
  colBody: { marginTop: 10 },
  colEmpty: { paddingVertical: 26, alignItems: 'center' },
  colEmptyTx: { fontSize: 12, color: T.faint },

  card: {
    backgroundColor: T.card, borderRadius: 10, padding: 11, borderTopWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ref: { fontSize: 10.5, fontWeight: '700', color: T.faint },
  cardTitle: { fontSize: 13, fontWeight: '700', color: T.ink, marginTop: 8, lineHeight: 18 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  assignee: { fontSize: 11.5, fontWeight: '600', color: T.ink },
  effort: { fontSize: 10.5, color: T.sub, marginTop: 1 },
  moveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  moveTx: { fontSize: 15, fontWeight: '800', color: T.primary },

  lateStrip: { marginTop: 9, backgroundColor: '#FEE2E2', borderRadius: 6, paddingVertical: 3, alignItems: 'center' },
  lateTx: { fontSize: 10, fontWeight: '800', color: '#991B1B' },

  offlineWrap: { paddingHorizontal: 16, paddingBottom: 8 },
});
