import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { managementKind } from '../../store/slices/authSlice';
import { projectApi, workItemApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import Icon from '../../components/Icon';
import { Avatar, BoardHeader, EmptyState, OfflineNote, PriorityChip, StateChip, TypeBadge } from './components';
import { ProgressBar } from './charts';
import { fmtHours, isOverdue, refOf, T, TYPE_META, WorkItem, WorkItemType } from './boardTheme';

type Filter = 'all' | WorkItemType;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'epic', label: 'Epics' },
  { key: 'feature', label: 'Features' },
  { key: 'user_story', label: 'Stories' },
  { key: 'task', label: 'Tasks' },
  { key: 'bug', label: 'Bugs' },
];

/**
 * The backlog as a collapsible hierarchy — Epic → Feature → User Story →
 * Task/Bug — with each parent showing the effort and completion rolled up from
 * everything beneath it.
 */
export default function ProjectBacklogScreen({ route, navigation }: any) {
  const projectId: string = route?.params?.projectId;
  const projectKey: string = route?.params?.projectKey;
  const role = useSelector((s: RootState) => s.auth.user?.role);
  const canManage = !!managementKind(role);

  const [tree, setTree] = useState<WorkItem[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<Filter>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const { data } = await workItemApi.tree(projectId, sprintFilter || undefined);
      setTree(Array.isArray(data) ? data : []);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    try {
      const { data } = await projectApi.sprints(projectId);
      if (Array.isArray(data)) setSprints(data);
    } catch { /* filter bar is optional */ }
    setLoading(false);
  }, [projectId, sprintFilter]);

  useLivePolling(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  /** Flatten for rendering, honouring collapse state and the type filter. */
  const rows = useMemo(() => {
    const out: { item: WorkItem; depth: number; hasKids: boolean }[] = [];
    const walk = (nodes: WorkItem[], depth: number) => {
      for (const n of nodes) {
        const kids = n.children ?? [];
        const matches = typeFilter === 'all' || n.type === typeFilter;
        if (matches) out.push({ item: n, depth: typeFilter === 'all' ? depth : 0, hasKids: kids.length > 0 });
        // A filtered view is a flat list, so keep walking regardless of collapse.
        if (kids.length && (typeFilter !== 'all' || !collapsed[n.id])) walk(kids, depth + 1);
      }
    };
    walk(tree, 0);
    return out;
  }, [tree, collapsed, typeFilter]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    const walk = (nodes: WorkItem[]) => {
      for (const n of nodes) {
        acc[n.type] = (acc[n.type] || 0) + 1;
        acc.all = (acc.all || 0) + 1;
        if (n.children?.length) walk(n.children);
      }
    };
    walk(tree);
    return acc;
  }, [tree]);

  return (
    <View style={st.root}>
      <BoardHeader
        title="Backlog"
        subtitle={`${projectKey || 'Project'} · epic → feature → story → task`}
        navigation={navigation}
        right={
          canManage ? (
            <TouchableOpacity
              style={st.addBtn}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('CreateWorkItem', { projectId, projectKey })}
            >
              <Text style={st.addBtnTx}>+ New</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Type filter */}
      <View style={st.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
          {FILTERS.map((f) => {
            const on = typeFilter === f.key;
            return (
              <TouchableOpacity key={f.key} style={[st.chip, on && st.chipOn]} onPress={() => setTypeFilter(f.key)} activeOpacity={0.8}>
                <Text style={[st.chipTx, on && st.chipTxOn]}>
                  {f.label}{counts[f.key] ? ` ${counts[f.key]}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Sprint filter */}
      {sprints.length > 0 && (
        <View style={st.filterBarTight}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
            <TouchableOpacity style={[st.chipSm, !sprintFilter && st.chipOn]} onPress={() => setSprintFilter(null)} activeOpacity={0.8}>
              <Text style={[st.chipTxSm, !sprintFilter && st.chipTxOn]}>Whole backlog</Text>
            </TouchableOpacity>
            {sprints.map((s) => {
              const on = sprintFilter === s.id;
              return (
                <TouchableOpacity key={s.id} style={[st.chipSm, on && st.chipOn]} onPress={() => setSprintFilter(s.id)} activeOpacity={0.8}>
                  <Text style={[st.chipTxSm, on && st.chipTxOn]}>{s.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={st.center}><ActivityIndicator size="large" color={T.primary} /></View>
      ) : (
        <ScrollView
          style={st.body}
          contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
        >
          {offline && <OfflineNote />}

          {rows.length === 0 ? (
            <EmptyState
              icon="file-text"
              title="Nothing in this backlog"
              subtitle={canManage ? 'Create an epic, then break it down into features, stories and tasks.' : 'Work items will appear here once the team plans them.'}
            />
          ) : (
            rows.map(({ item, depth, hasKids }) => {
              const meta = TYPE_META[item.type];
              const rollup = item.rollup;
              const late = isOverdue(item);
              return (
                <View key={item.id} style={{ marginLeft: depth * 14 }}>
                  <TouchableOpacity
                    style={[st.row, { borderLeftColor: meta.solid }]}
                    activeOpacity={0.85}
                    onPress={() => navigation?.navigate('WorkItemDetail', { id: item.id, projectKey })}
                  >
                    <View style={st.rowTop}>
                      {hasKids ? (
                        <TouchableOpacity
                          onPress={() => toggle(item.id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={st.caret}
                        >
                          <Text style={st.caretTx}>{collapsed[item.id] ? '▸' : '▾'}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={st.caret} />
                      )}
                      <TypeBadge type={item.type} compact />
                      <Text style={st.ref}>{refOf(projectKey, item.seq)}</Text>
                      <View style={{ flex: 1 }} />
                      <PriorityChip priority={item.priority} />
                    </View>

                    <Text style={st.title} numberOfLines={2}>{item.title}</Text>

                    <View style={st.rowMeta}>
                      <StateChip state={item.state} />
                      {item.storyPoints > 0 && (
                        <View style={st.ptChip}><Text style={st.ptChipTx}>{item.storyPoints} pts</Text></View>
                      )}
                      {item.originalEstimate > 0 && (
                        <Text style={st.metaTx}>
                          {fmtHours(item.completedWork)} / {fmtHours(item.originalEstimate)}
                        </Text>
                      )}
                      {late && <Text style={st.overdueTx}>Overdue</Text>}
                      <View style={{ flex: 1 }} />
                      <Avatar name={item.assigneeName} size={24} />
                    </View>

                    {/* Rolled-up progress for parents */}
                    {!!rollup && rollup.total > 1 && (
                      <View style={st.rollup}>
                        <ProgressBar pct={rollup.progress} color={meta.solid} height={5} />
                        <View style={st.rollupFoot}>
                          <Text style={st.rollupTx}>{rollup.closed}/{rollup.total} closed</Text>
                          <Text style={st.rollupTx}>{fmtHours(rollup.remaining)} remaining</Text>
                          {rollup.points > 0 && <Text style={st.rollupTx}>{rollup.points} pts</Text>}
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>

                  {canManage && hasKids === false && item.type !== 'task' && (
                    <TouchableOpacity
                      style={st.addChild}
                      activeOpacity={0.8}
                      onPress={() => navigation?.navigate('CreateWorkItem', { projectId, projectKey, parentId: item.id, parentType: item.type, parentTitle: item.title })}
                    >
                      <Icon name="chevron-right" size={12} color={T.faint} />
                      <Text style={st.addChildTx}>Add child</Text>
                    </TouchableOpacity>
                  )}
                </View>
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

  addBtn: { backgroundColor: T.primary, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 },
  addBtnTx: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  filterBar: { paddingVertical: 10, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line },
  filterBarTight: { paddingVertical: 8, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line },
  chip: { backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 7 },
  chipSm: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5.5 },
  chipOn: { backgroundColor: T.primary },
  chipTx: { fontSize: 12.5, fontWeight: '700', color: T.sub },
  chipTxSm: { fontSize: 11.5, fontWeight: '600', color: T.sub },
  chipTxOn: { color: '#FFF' },

  row: {
    backgroundColor: T.card, borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  caret: { width: 16, alignItems: 'center' },
  caretTx: { fontSize: 13, color: T.sub, fontWeight: '700' },
  ref: { fontSize: 11, fontWeight: '700', color: T.faint },
  title: { fontSize: 13.5, fontWeight: '700', color: T.ink, marginTop: 8, lineHeight: 19 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  metaTx: { fontSize: 11, color: T.sub, fontWeight: '600' },
  overdueTx: { fontSize: 10.5, fontWeight: '800', color: '#991B1B' },
  ptChip: { backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  ptChipTx: { fontSize: 10.5, fontWeight: '800', color: '#5B21B6' },

  rollup: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  rollupFoot: { flexDirection: 'row', gap: 14, marginTop: 6 },
  rollupTx: { fontSize: 10.5, color: T.sub },

  addChild: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 14, paddingBottom: 10, marginTop: -2 },
  addChildTx: { fontSize: 11, color: T.faint, fontWeight: '600' },
});
