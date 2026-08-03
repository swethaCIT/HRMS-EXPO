import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { managementKind } from '../../store/slices/authSlice';
import { projectApi, workItemApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import Icon from '../../components/Icon';
import { BoardHeader, EmptyState, OfflineNote, StatTile } from './components';
import { ProgressBar } from './charts';
import { PROJECT_STATUS_META, ProjectSummary, relativeDays, T } from './boardTheme';

/**
 * "Goals" — the project list. Tapping a project opens its board (teams, sprints,
 * backlog and reports). Managers/HR/admin can create new projects from here.
 */
export default function ProjectsScreen({ navigation }: any) {
  const role = useSelector((s: RootState) => s.auth.user?.role);
  const canManage = !!managementKind(role);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [mine, setMine] = useState<{ total: number; active: number; closed: number; remaining: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await projectApi.list();
      if (Array.isArray(data)) setProjects(data as ProjectSummary[]);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    try {
      const { data } = await workItemApi.mine();
      setMine(data?.stats ?? null);
    } catch { /* the personal strip is optional */ }
    setLoading(false);
  }, []);

  // Keep the list live while it's on screen — a teammate closing an item should
  // move the progress bar without the user leaving and coming back.
  useLivePolling(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const totalItems = projects.reduce((s, p) => s + (p.itemsTotal || 0), 0);
  const totalClosed = projects.reduce((s, p) => s + (p.itemsClosed || 0), 0);
  const overdue = projects.reduce((s, p) => s + (p.overdue || 0), 0);

  return (
    <View style={st.root}>
      <BoardHeader
        title="Goals"
        subtitle={`${projects.length} project${projects.length === 1 ? '' : 's'} · project management board`}
        navigation={navigation}
        right={
          canManage ? (
            <TouchableOpacity style={st.newBtn} onPress={() => navigation?.navigate('CreateProject')} activeOpacity={0.85}>
              <Text style={st.newBtnTx}>+ New</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <View style={st.center}><ActivityIndicator size="large" color={T.primary} /></View>
      ) : (
        <ScrollView
          style={st.body}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
        >
          {offline && <OfflineNote />}

          {/* Portfolio rollup */}
          <View style={st.statRow}>
            <StatTile value={projects.length} label="Projects" />
            <StatTile value={totalItems} label="Work items" color="#0EA5E9" />
            <StatTile value={`${totalItems ? Math.round((totalClosed / totalItems) * 100) : 0}%`} label="Completed" color="#10B981" />
            <StatTile value={overdue} label="Overdue" color={overdue ? '#EF4444' : T.faint} />
          </View>

          {/* My assigned work across every board */}
          {!!mine && mine.total > 0 && (
            <TouchableOpacity style={st.mineCard} activeOpacity={0.85} onPress={() => navigation?.navigate('MyWorkItems')}>
              <View style={st.mineIcon}><Icon name="check-square" size={18} color={T.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.mineLabel}>ASSIGNED TO ME</Text>
                <Text style={st.mineTitle}>
                  {mine.active} active · {mine.total} total · {mine.remaining}h left
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={T.faint} />
            </TouchableOpacity>
          )}

          {projects.length === 0 ? (
            <EmptyState
              icon="briefcase"
              title="No projects yet"
              subtitle={canManage ? 'Tap “+ New” to create your first project board.' : 'Your manager has not published a project board yet.'}
            />
          ) : (
            projects.map((p) => {
              const status = PROJECT_STATUS_META[p.status] ?? PROJECT_STATUS_META.active;
              const accent = p.color || T.primary;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={st.card}
                  activeOpacity={0.85}
                  onPress={() => navigation?.navigate('ProjectDetail', { id: p.id, name: p.name })}
                >
                  <View style={st.cardTop}>
                    <View style={[st.keyChip, { backgroundColor: accent }]}>
                      <Text style={st.keyChipTx}>{(p.key || '?').slice(0, 5)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.cardTitle} numberOfLines={1}>{p.name}</Text>
                      <Text style={st.cardSub} numberOfLines={1}>
                        {p.ownerName ? `Owner ${p.ownerName}` : 'No owner'} · {p.teamCount} team{p.teamCount === 1 ? '' : 's'} · {p.memberCount} member{p.memberCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <View style={[st.statusChip, { backgroundColor: status.bg }]}>
                      <Text style={[st.statusChipTx, { color: status.fg }]}>{status.label}</Text>
                    </View>
                  </View>

                  {!!p.description && <Text style={st.cardDesc} numberOfLines={2}>{p.description}</Text>}

                  <View style={st.progressRow}>
                    <Text style={st.progressPct}>{p.progress}%</Text>
                    <View style={{ flex: 1 }}>
                      <ProgressBar pct={p.progress} color={accent} />
                    </View>
                    <Text style={st.progressCount}>{p.itemsClosed}/{p.itemsTotal}</Text>
                  </View>

                  <View style={st.metaRow}>
                    {p.currentSprint ? (
                      <View style={st.metaChip}>
                        <Icon name="clock" size={12} color={T.primary} />
                        <Text style={st.metaChipTx}>{p.currentSprint.name} · ends {relativeDays(p.currentSprint.endDate)}</Text>
                      </View>
                    ) : (
                      <View style={st.metaChip}>
                        <Icon name="calendar" size={12} color={T.faint} />
                        <Text style={[st.metaChipTx, { color: T.sub }]}>No active sprint</Text>
                      </View>
                    )}
                    {p.itemsActive > 0 && (
                      <View style={[st.metaChip, { backgroundColor: '#DBEAFE' }]}>
                        <Text style={[st.metaChipTx, { color: '#1D4ED8' }]}>{p.itemsActive} active</Text>
                      </View>
                    )}
                    {p.overdue > 0 && (
                      <View style={[st.metaChip, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[st.metaChipTx, { color: '#991B1B' }]}>{p.overdue} overdue</Text>
                      </View>
                    )}
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

  newBtn: { backgroundColor: T.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  newBtnTx: { color: '#FFF', fontSize: 12.5, fontWeight: '700' },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },

  mineCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 14,
    padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: T.primary,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  mineIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  mineLabel: { fontSize: 10, fontWeight: '800', color: T.faint, letterSpacing: 0.8 },
  mineTitle: { fontSize: 13.5, fontWeight: '700', color: T.ink, marginTop: 2 },

  card: {
    backgroundColor: T.card, borderRadius: 16, padding: 14, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  keyChip: { width: 46, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  keyChipTx: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: T.ink },
  cardSub: { fontSize: 11.5, color: T.sub, marginTop: 2 },
  statusChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusChipTx: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  cardDesc: { fontSize: 12.5, color: T.sub, marginTop: 10, lineHeight: 18 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  progressPct: { width: 38, fontSize: 12.5, fontWeight: '800', color: T.ink },
  progressCount: { width: 48, textAlign: 'right', fontSize: 11.5, color: T.sub },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  metaChipTx: { fontSize: 10.5, fontWeight: '700', color: T.primary },
});
