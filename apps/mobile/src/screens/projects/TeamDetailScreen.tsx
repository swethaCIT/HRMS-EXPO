import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { managementKind } from '../../store/slices/authSlice';
import { projectApi, sprintApi, workItemApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import { getErrorMessage } from '../../utils/errorMessage';
import Icon from '../../components/Icon';
import { Avatar, BoardHeader, EmptyState, OfflineNote, StatTile, StateChip, TypeBadge } from './components';
import { Burndown, ProgressBar } from './charts';
import { fmtDate, fmtHours, refOf, SPRINT_STATUS_META, SprintStatus, T, WorkItem } from './boardTheme';

/**
 * Team detail — who's on the squad, who runs it, its own sprint burndown and
 * the work it is carrying.
 */
export default function TeamDetailScreen({ route, navigation }: any) {
  const teamId: string = route?.params?.teamId;
  const projectId: string | undefined = route?.params?.projectId;
  const [team, setTeam] = useState<any>(null);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [sprintId, setSprintId] = useState<string | null>(null);
  const [burn, setBurn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!teamId) return;
    try {
      const { data } = await projectApi.team(teamId);
      setTeam(data);
      setOffline(false);
      // Default the graph to the running sprint the first time through.
      setSprintId((cur) => cur ?? (data?.sprints ?? []).find((s: any) => s.status === 'current')?.id ?? data?.sprints?.[0]?.id ?? null);
    } catch {
      setOffline(true);
    }
    try {
      const { data } = await workItemApi.list({ teamId });
      setItems(Array.isArray(data) ? data.filter((i: WorkItem) => i.state !== 'removed') : []);
    } catch { /* optional */ }
    setLoading(false);
  }, [teamId]);

  useLivePolling(useCallback(() => { load(); }, [load]));

  // The squad's slice of the selected sprint — this is the team sprint graph.
  useEffect(() => {
    if (!sprintId) { setBurn(null); return; }
    (async () => {
      try {
        const { data } = await sprintApi.burndown(sprintId, teamId);
        setBurn(data);
      } catch {
        setBurn(null);
      }
    })();
  }, [sprintId, teamId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const removeMember = (member: any) => {
    Alert.alert('Remove member', `Remove ${member.name} from ${team?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await projectApi.removeMember(member.id);
            await load();
          } catch (err) {
            Alert.alert('Could not remove', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const role = useSelector((s: RootState) => s.auth.user?.role);
  const canManage = !!managementKind(role);

  if (loading) {
    return (
      <View style={st.root}>
        <BoardHeader title="Team" navigation={navigation} />
        <View style={st.center}><ActivityIndicator size="large" color={T.primary} /></View>
      </View>
    );
  }

  if (!team) {
    return (
      <View style={st.root}>
        <BoardHeader title="Team" navigation={navigation} />
        <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {offline && <OfflineNote />}
          <EmptyState icon="users" title="Team unavailable" subtitle="Pull down to try again." />
        </ScrollView>
      </View>
    );
  }

  const stats = team.stats || {};
  const activeItems = items.filter((i) => i.state === 'active' || i.state === 'new').slice(0, 12);

  return (
    <View style={st.root}>
      <BoardHeader
        title={team.name}
        subtitle={`${team.projectName || 'Project'} · ${team.members?.length ?? 0} member${(team.members?.length ?? 0) === 1 ? '' : 's'}`}
        navigation={navigation}
      />

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {offline && <OfflineNote />}

        {/* Manager */}
        <View style={st.mgrCard}>
          <Avatar name={team.managerName} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={st.mgrLabel}>TEAM MANAGER</Text>
            <Text style={st.mgrName}>{team.managerName || 'Not assigned'}</Text>
            {!!team.description && <Text style={st.mgrDesc} numberOfLines={2}>{team.description}</Text>}
          </View>
        </View>

        {/* Squad health */}
        <View style={st.statRow}>
          <StatTile value={stats.itemsTotal ?? 0} label="Work items" />
          <StatTile value={stats.active ?? 0} label="Active" color="#2563EB" />
          <StatTile value={`${stats.progress ?? 0}%`} label="Complete" color="#10B981" />
          <StatTile value={fmtHours(stats.remaining)} label="Remaining" color="#F59E0B" />
        </View>

        {/* Team sprint graph */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>SPRINT GRAPH</Text>
              <Text style={st.cardSub}>This squad's burndown for the selected iteration</Text>
            </View>
            {!!burn && (
              <View style={[st.varChip, { backgroundColor: burn.variance >= 0 ? T.green.bg : T.red.bg }]}>
                <Text style={[st.varChipTx, { color: burn.variance >= 0 ? T.green.fg : T.red.fg }]}>
                  {burn.variance >= 0 ? '▲ On track' : '▼ Behind'}
                </Text>
              </View>
            )}
          </View>

          {(team.sprints ?? []).length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              {team.sprints.map((s: any) => {
                const on = sprintId === s.id;
                const meta = SPRINT_STATUS_META[s.status as SprintStatus] ?? SPRINT_STATUS_META.future;
                return (
                  <TouchableOpacity key={s.id} style={[st.chip, on && st.chipOn]} onPress={() => setSprintId(s.id)} activeOpacity={0.85}>
                    <Text style={[st.chipTx, on && st.chipTxOn]}>{s.name}</Text>
                    {!on && <Text style={[st.chipMeta, { color: meta.fg }]}>{meta.label}</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {burn ? (
            <>
              <Burndown labels={burn.labels} ideal={burn.ideal} actual={burn.actual} />
              <View style={st.statRow}>
                <StatTile value={burn.total} label={`Committed ${burn.unit}`} />
                <StatTile value={burn.currentRemaining} label="Remaining" color="#F59E0B" />
                <StatTile value={`${burn.itemsClosed}/${burn.itemsTotal}`} label="Closed" color="#10B981" />
                <StatTile value={burn.daysLeft} label="Days left" color="#0EA5E9" />
              </View>
              <TouchableOpacity
                style={st.linkRow}
                activeOpacity={0.8}
                onPress={() => navigation?.navigate('SprintDetail', { sprintId, projectId, projectKey: team.projectKey })}
              >
                <Text style={st.linkTx}>Open full sprint</Text>
                <Icon name="chevron-right" size={16} color={T.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <Text style={st.muted}>No iteration selected, or this squad has nothing planned in it yet.</Text>
          )}
        </View>

        {/* Members */}
        <Text style={st.sectionTitle}>MEMBERS · {team.members?.length ?? 0}</Text>
        <View style={st.card}>
          {(team.members ?? []).length === 0 ? (
            <Text style={st.muted}>No members on this squad yet.</Text>
          ) : (
            team.members.map((m: any, i: number) => (
              <TouchableOpacity
                key={m.id}
                style={[st.memberRow, i < team.members.length - 1 && st.divider]}
                activeOpacity={0.85}
                onPress={() =>
                  projectId &&
                  navigation?.navigate('MemberReport', { projectId, employeeId: m.employeeId, name: m.name, projectKey: team.projectKey })
                }
                onLongPress={() => canManage && removeMember(m)}
              >
                <Avatar name={m.name} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={st.memberName} numberOfLines={1}>{m.name}</Text>
                  <Text style={st.memberRole} numberOfLines={1}>
                    {m.role || 'Team member'} · {m.capacityHoursPerDay}h/day
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar pct={m.completionPct} height={5} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.memberVal}>{m.closed}/{m.assigned}</Text>
                  <Text style={st.memberSub}>{fmtHours(m.hoursLogged)} logged</Text>
                  <Text style={st.memberSub}>{fmtHours(m.remaining)} left</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
        {canManage && <Text style={st.hint}>Long-press a member to remove them from the squad.</Text>}

        {/* Open work */}
        {activeItems.length > 0 && (
          <>
            <Text style={st.sectionTitle}>OPEN WORK · {activeItems.length}</Text>
            {activeItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={st.itemRow}
                activeOpacity={0.85}
                onPress={() => navigation?.navigate('WorkItemDetail', { id: item.id, projectKey: team.projectKey })}
              >
                <View style={st.itemTop}>
                  <TypeBadge type={item.type} compact />
                  <Text style={st.itemRef}>{refOf(team.projectKey, item.seq)}</Text>
                  <View style={{ flex: 1 }} />
                  <StateChip state={item.state} />
                </View>
                <Text style={st.itemTitle} numberOfLines={2}>{item.title}</Text>
                <View style={st.itemFoot}>
                  <Avatar name={item.assigneeName} size={22} />
                  <Text style={st.itemFootTx} numberOfLines={1}>{item.assigneeName || 'Unassigned'}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={st.itemFootTx}>Due {fmtDate(item.targetDate)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 12.5, color: T.sub, lineHeight: 18 },
  hint: { fontSize: 11, color: T.faint, marginTop: -6, marginBottom: 16, textAlign: 'center' },

  mgrCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 16, padding: 14,
    marginBottom: 14, borderLeftWidth: 3, borderLeftColor: T.primary,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  mgrLabel: { fontSize: 10, fontWeight: '800', color: T.faint, letterSpacing: 0.8 },
  mgrName: { fontSize: 15.5, fontWeight: '800', color: T.ink, marginTop: 2 },
  mgrDesc: { fontSize: 11.5, color: T.sub, marginTop: 4, lineHeight: 16 },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },

  card: {
    backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.8 },
  cardSub: { fontSize: 11.5, color: T.faint, marginTop: 2, marginBottom: 12 },
  varChip: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  varChipTx: { fontSize: 10.5, fontWeight: '800' },

  chip: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center' },
  chipOn: { backgroundColor: T.primary },
  chipTx: { fontSize: 12, fontWeight: '700', color: T.sub },
  chipTxOn: { color: '#FFF' },
  chipMeta: { fontSize: 9, fontWeight: '700', marginTop: 1 },

  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  linkTx: { fontSize: 12.5, fontWeight: '700', color: T.primary },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#374151', letterSpacing: 0.8, marginBottom: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  memberName: { fontSize: 13.5, fontWeight: '700', color: T.ink },
  memberRole: { fontSize: 11, color: T.sub, marginTop: 2 },
  memberVal: { fontSize: 13.5, fontWeight: '800', color: T.ink },
  memberSub: { fontSize: 10, color: T.sub, marginTop: 2 },

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
