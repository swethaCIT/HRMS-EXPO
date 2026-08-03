import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { managementKind } from '../../store/slices/authSlice';
import { projectApi, sprintApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import Icon, { IconName } from '../../components/Icon';
import { Avatar, BoardHeader, EmptyState, OfflineNote, StatTile } from './components';
import { Burndown, ProgressBar, StateBar } from './charts';
import { fmtDate, fmtHours, PROJECT_STATUS_META, SPRINT_STATUS_META, STATE_META, T } from './boardTheme';

const ACTIONS: { key: string; label: string; icon: IconName; screen: string; tint: string }[] = [
  { key: 'backlog', label: 'Backlog',  icon: 'file-text',    screen: 'ProjectBacklog', tint: '#4F46E5' },
  { key: 'board',   label: 'Board',    icon: 'check-square', screen: 'ProjectBoard',   tint: '#0EA5E9' },
  { key: 'sprints', label: 'Sprints',  icon: 'calendar',     screen: 'ProjectSprints', tint: '#F59E0B' },
  { key: 'reports', label: 'Reports',  icon: 'bar-chart',    screen: 'ProjectReports', tint: '#10B981' },
];

/**
 * Project home: health, the running sprint's burndown, the squads working on it
 * and the way into the backlog / board / sprints / reports.
 */
export default function ProjectDetailScreen({ route, navigation }: any) {
  const projectId: string = route?.params?.id;
  const role = useSelector((s: RootState) => s.auth.user?.role);
  const canManage = !!managementKind(role);

  const [project, setProject] = useState<any>(null);
  const [burn, setBurn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const { data } = await projectApi.getOne(projectId);
      setProject(data);
      setOffline(false);
      const sprintId = data?.currentSprint?.id;
      if (sprintId) {
        try {
          const res = await sprintApi.burndown(sprintId);
          setBurn(res.data);
        } catch { setBurn(null); }
      } else {
        setBurn(null);
      }
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, [projectId]);

  useLivePolling(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onDelete = () => {
    Alert.alert('Delete project', `“${project?.name}” and all of its work items will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await projectApi.remove(projectId);
            navigation?.goBack();
          } catch {
            Alert.alert('Could not delete', 'The server rejected the request.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={st.root}>
        <BoardHeader title={route?.params?.name || 'Project'} navigation={navigation} />
        <View style={st.center}><ActivityIndicator size="large" color={T.primary} /></View>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={st.root}>
        <BoardHeader title={route?.params?.name || 'Project'} navigation={navigation} />
        <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {offline && <OfflineNote />}
          <EmptyState icon="briefcase" title="Project unavailable" subtitle="Pull down to try again." />
        </ScrollView>
      </View>
    );
  }

  const stats = project.stats || {};
  const accent = project.color || T.primary;
  const status = PROJECT_STATUS_META[project.status as keyof typeof PROJECT_STATUS_META] ?? PROJECT_STATUS_META.active;
  const segments = [
    { value: stats.new || 0, color: STATE_META.new.solid },
    { value: stats.active || 0, color: STATE_META.active.solid },
    { value: stats.resolved || 0, color: STATE_META.resolved.solid },
    { value: stats.closed || 0, color: STATE_META.closed.solid },
  ];

  return (
    <View style={st.root}>
      <BoardHeader
        title={project.name}
        subtitle={`${project.key} · ${status.label}`}
        navigation={navigation}
        right={
          canManage ? (
            <TouchableOpacity
              style={st.addBtn}
              onPress={() => navigation?.navigate('CreateWorkItem', { projectId, projectKey: project.key })}
              activeOpacity={0.85}
            >
              <Text style={st.addBtnTx}>+ Item</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {offline && <OfflineNote />}

        {/* ── Health hero ── */}
        <View style={[st.hero, { backgroundColor: T.headerAlt }]}>
          <View style={st.heroTop}>
            <View style={[st.keyChip, { backgroundColor: accent }]}>
              <Text style={st.keyChipTx}>{(project.key || '?').slice(0, 5)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.heroName} numberOfLines={2}>{project.name}</Text>
              <Text style={st.heroSub}>
                {fmtDate(project.startDate)} → {fmtDate(project.targetDate)}
              </Text>
            </View>
            <Text style={st.heroPct}>{stats.progress ?? 0}%</Text>
          </View>
          {!!project.description && <Text style={st.heroDesc}>{project.description}</Text>}
          <View style={st.heroBar}>
            <ProgressBar pct={stats.progress ?? 0} color="#A5B4FC" height={7} />
          </View>
          <View style={st.heroFoot}>
            <Text style={st.heroFootTx}>{stats.closed ?? 0} of {stats.itemsTotal ?? 0} items closed</Text>
            <Text style={st.heroFootTx}>Owner · {project.ownerName || '—'}</Text>
          </View>
        </View>

        {/* ── Work-item state mix ── */}
        <View style={st.card}>
          <Text style={st.cardTitle}>WORK ITEM STATES</Text>
          <Text style={st.cardSub}>Azure workflow across the whole project</Text>
          <StateBar segments={segments} />
          <View style={st.legendGrid}>
            {(['new', 'active', 'resolved', 'closed'] as const).map((s) => (
              <View key={s} style={st.legendCell}>
                <View style={[st.legendDot, { backgroundColor: STATE_META[s].solid }]} />
                <Text style={st.legendLabel}>{STATE_META[s].label}</Text>
                <Text style={st.legendVal}>{stats[s] ?? 0}</Text>
              </View>
            ))}
          </View>
          <View style={st.effortRow}>
            <StatTile value={fmtHours(stats.estimated)} label="Estimated" />
            <StatTile value={fmtHours(stats.completed)} label="Completed" color="#10B981" />
            <StatTile value={fmtHours(stats.remaining)} label="Remaining" color="#F59E0B" />
            <StatTile value={stats.storyPoints ?? 0} label="Points" color="#7C3AED" />
          </View>
        </View>

        {/* ── Navigation grid ── */}
        <View style={st.actionGrid}>
          {ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={st.actionCard}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate(a.screen, { projectId, projectKey: project.key, name: project.name })}
            >
              <View style={[st.actionIcon, { backgroundColor: `${a.tint}1A` }]}>
                <Icon name={a.icon} size={18} color={a.tint} />
              </View>
              <Text style={st.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Current sprint burndown ── */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>SPRINT BURNDOWN</Text>
              <Text style={st.cardSub}>
                {burn?.sprint ? `${burn.sprint.name} · ${burn.daysLeft} day${burn.daysLeft === 1 ? '' : 's'} left` : 'No sprint running'}
              </Text>
            </View>
            {!!burn && (
              <View style={[st.varChip, { backgroundColor: burn.variance >= 0 ? T.green.bg : T.red.bg }]}>
                <Text style={[st.varChipTx, { color: burn.variance >= 0 ? T.green.fg : T.red.fg }]}>
                  {burn.variance >= 0 ? '▲ On track' : '▼ Behind'} {Math.abs(burn.variance)}
                </Text>
              </View>
            )}
          </View>

          {burn ? (
            <>
              <Burndown labels={burn.labels} ideal={burn.ideal} actual={burn.actual} />
              <View style={st.burnStats}>
                <StatTile value={burn.currentRemaining} label={`Remaining ${burn.unit === 'hours' ? 'hrs' : burn.unit}`} color="#F59E0B" />
                <StatTile value={`${burn.itemsClosed}/${burn.itemsTotal}`} label="Items closed" color="#10B981" />
                <StatTile value={burn.hoursLogged} label="Hours logged" color="#0EA5E9" />
                <StatTile value={`${burn.daysElapsed}/${burn.daysTotal}`} label="Sprint days" />
              </View>
              <TouchableOpacity
                style={st.linkRow}
                activeOpacity={0.8}
                onPress={() => navigation?.navigate('SprintDetail', { sprintId: burn.sprint.id, projectId, projectKey: project.key })}
              >
                <Text style={st.linkTx}>Open sprint</Text>
                <Icon name="chevron-right" size={16} color={T.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <Text style={st.muted}>
              {canManage ? 'Create a sprint from the Sprints screen to start tracking a burndown.' : 'The team has not started a sprint yet.'}
            </Text>
          )}
        </View>

        {/* ── Teams ── */}
        <View style={st.sectionHead}>
          <Text style={st.sectionTitle}>TEAMS · {project.teams?.length ?? 0}</Text>
          {canManage && (
            <TouchableOpacity onPress={() => navigation?.navigate('CreateTeam', { projectId, name: project.name })}>
              <Text style={st.sectionLink}>+ Add team</Text>
            </TouchableOpacity>
          )}
        </View>

        {(project.teams ?? []).length === 0 ? (
          <View style={st.card}>
            <Text style={st.muted}>No teams on this project yet.</Text>
          </View>
        ) : (
          project.teams.map((t: any) => (
            <TouchableOpacity
              key={t.id}
              style={st.teamCard}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('TeamDetail', { teamId: t.id, projectId, projectKey: project.key })}
            >
              <View style={st.teamTop}>
                <View style={{ flex: 1 }}>
                  <Text style={st.teamName} numberOfLines={1}>{t.name}</Text>
                  <Text style={st.teamSub} numberOfLines={1}>
                    Manager · {t.managerName || '—'}
                  </Text>
                </View>
                <View style={st.avatarStack}>
                  {(t.members ?? []).slice(0, 4).map((m: any, i: number) => (
                    <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -9 }}>
                      <Avatar name={m.name} size={26} />
                    </View>
                  ))}
                  {(t.members?.length ?? 0) > 4 && (
                    <View style={st.moreAvatar}><Text style={st.moreAvatarTx}>+{t.members.length - 4}</Text></View>
                  )}
                </View>
              </View>
              <View style={st.teamProgress}>
                <ProgressBar pct={t.itemsTotal ? Math.round((t.itemsClosed / t.itemsTotal) * 100) : 0} color={accent} height={6} />
              </View>
              <View style={st.teamFoot}>
                <Text style={st.teamFootTx}>{t.memberCount} member{t.memberCount === 1 ? '' : 's'}</Text>
                <Text style={st.teamFootTx}>{t.itemsActive} active</Text>
                <Text style={st.teamFootTx}>{t.itemsClosed}/{t.itemsTotal} closed</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* ── Sprint list (compact) ── */}
        {(project.sprints ?? []).length > 0 && (
          <>
            <View style={st.sectionHead}>
              <Text style={st.sectionTitle}>ITERATIONS · {project.sprints.length}</Text>
              <TouchableOpacity onPress={() => navigation?.navigate('ProjectSprints', { projectId, projectKey: project.key, name: project.name })}>
                <Text style={st.sectionLink}>See all ›</Text>
              </TouchableOpacity>
            </View>
            <View style={st.card}>
              {project.sprints.map((s: any, i: number) => {
                const meta = SPRINT_STATUS_META[s.status as keyof typeof SPRINT_STATUS_META] ?? SPRINT_STATUS_META.future;
                return (
                  <TouchableOpacity
                    key={s.id}
                    activeOpacity={0.8}
                    onPress={() => navigation?.navigate('SprintDetail', { sprintId: s.id, projectId, projectKey: project.key })}
                    style={[st.sprintRow, i < project.sprints.length - 1 && st.divider]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={st.sprintName} numberOfLines={1}>{s.name}</Text>
                      <Text style={st.sprintDates}>{fmtDate(s.startDate)} → {fmtDate(s.endDate)}</Text>
                    </View>
                    <View style={[st.statusChip, { backgroundColor: meta.bg }]}>
                      <Text style={[st.statusChipTx, { color: meta.fg }]}>{meta.label}</Text>
                    </View>
                    <Icon name="chevron-right" size={16} color={T.faint} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {canManage && (
          <TouchableOpacity style={st.deleteBtn} onPress={onDelete} activeOpacity={0.85}>
            <Text style={st.deleteTx}>Delete project</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  addBtn: { backgroundColor: T.primary, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 },
  addBtnTx: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  hero: {
    borderRadius: 18, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  keyChip: { width: 48, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  keyChipTx: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroName: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11.5, marginTop: 3 },
  heroPct: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  heroDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  heroBar: { marginTop: 14 },
  heroFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  heroFootTx: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5 },

  card: {
    backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.8 },
  cardSub: { fontSize: 11.5, color: T.faint, marginTop: 2, marginBottom: 12 },
  muted: { fontSize: 12.5, color: T.sub, lineHeight: 18 },

  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  legendCell: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 12, color: T.sub },
  legendVal: { fontSize: 13, fontWeight: '800', color: T.ink, marginRight: 12 },

  effortRow: { flexDirection: 'row', gap: 8, marginTop: 12 },

  actionGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionCard: {
    flex: 1, backgroundColor: T.card, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  actionIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11.5, fontWeight: '700', color: T.ink },

  varChip: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  varChipTx: { fontSize: 10.5, fontWeight: '800' },
  burnStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  linkTx: { fontSize: 12.5, fontWeight: '700', color: T.primary },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#374151', letterSpacing: 0.8 },
  sectionLink: { fontSize: 12, fontWeight: '700', color: T.primary },

  teamCard: {
    backgroundColor: T.card, borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  teamTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamName: { fontSize: 14.5, fontWeight: '800', color: T.ink },
  teamSub: { fontSize: 11.5, color: T.sub, marginTop: 2 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  moreAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginLeft: -9 },
  moreAvatarTx: { fontSize: 9.5, fontWeight: '800', color: T.primary },
  teamProgress: { marginTop: 12 },
  teamFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  teamFootTx: { fontSize: 11, color: T.sub },

  sprintRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sprintName: { fontSize: 13.5, fontWeight: '700', color: T.ink },
  sprintDates: { fontSize: 11, color: T.sub, marginTop: 2 },
  statusChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusChipTx: { fontSize: 10, fontWeight: '800' },

  deleteBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  deleteTx: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
});
