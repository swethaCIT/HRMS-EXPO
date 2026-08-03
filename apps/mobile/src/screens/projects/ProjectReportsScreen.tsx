import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { projectApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import { Avatar, BoardHeader, EmptyState, OfflineNote, StatTile } from './components';
import { ColumnChart, Donut, ProgressBar, VelocityChart } from './charts';
import { fmtHours, PRIORITY_META, STATE_META, T, TYPE_META, WorkItemState, WorkItemType } from './boardTheme';

type Tab = 'project' | 'people';

/**
 * Project reporting: delivery health, velocity and effort for the project, plus
 * an individual report per person — what they were assigned, what they finished
 * and how much time they actually put in.
 */
export default function ProjectReportsScreen({ route, navigation }: any) {
  const projectId: string = route?.params?.projectId;
  const projectKey: string | undefined = route?.params?.projectKey;

  const [tab, setTab] = useState<Tab>('project');
  const [report, setReport] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const [r, m] = await Promise.all([projectApi.report(projectId), projectApi.memberReports(projectId)]);
      setReport(r.data);
      setPeople(m.data?.members ?? []);
      setOffline(false);
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

  if (loading) {
    return (
      <View style={st.root}>
        <BoardHeader title="Reports" navigation={navigation} />
        <View style={st.center}><ActivityIndicator size="large" color={T.primary} /></View>
      </View>
    );
  }

  const summary = report?.summary ?? {};
  const effort = report?.effort ?? {};
  const stateDonut = (report?.byState ?? []).map((s: any) => ({
    label: STATE_META[s.state as WorkItemState].label,
    value: s.count,
    color: STATE_META[s.state as WorkItemState].solid,
  }));
  const stateTotal = stateDonut.reduce((a: number, d: any) => a + d.value, 0);

  return (
    <View style={st.root}>
      <BoardHeader
        title="Reports"
        subtitle={`${projectKey || report?.project?.key || 'Project'} · ${tab === 'project' ? 'delivery health' : 'individual effort'}`}
        navigation={navigation}
      />

      <View style={st.tabs}>
        {(['project', 'people'] as Tab[]).map((t) => {
          const on = tab === t;
          return (
            <TouchableOpacity key={t} style={[st.tab, on && st.tabOn]} onPress={() => setTab(t)} activeOpacity={0.85}>
              <Text style={[st.tabTx, on && st.tabTxOn]}>{t === 'project' ? 'Project report' : `People · ${people.length}`}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {offline && <OfflineNote />}

        {!report ? (
          <EmptyState icon="bar-chart" title="Report unavailable" subtitle="Pull down to try again." />
        ) : tab === 'project' ? (
          <>
            {/* Headline */}
            <View style={st.statRow}>
              <StatTile value={`${summary.progress ?? 0}%`} label="Complete" color="#10B981" />
              <StatTile value={summary.itemsTotal ?? 0} label="Work items" />
              <StatTile value={summary.active ?? 0} label="Active" color="#2563EB" />
              <StatTile value={summary.overdue ?? 0} label="Overdue" color={summary.overdue ? '#EF4444' : T.faint} />
            </View>
            <View style={st.statRow}>
              <StatTile value={`${summary.onTimePct ?? 0}%`} label="On time" color="#10B981" />
              <StatTile value={summary.avgCycleDays ?? 0} label="Avg cycle (days)" color="#7C3AED" />
              <StatTile value={summary.bugsOpen ?? 0} label="Open bugs" color="#DC2626" />
              <StatTile value={summary.contributors ?? 0} label="Contributors" color="#0EA5E9" />
            </View>

            {/* Effort */}
            <View style={st.card}>
              <Text style={st.cardTitle}>EFFORT</Text>
              <Text style={st.cardSub}>Estimated vs booked hours across the project</Text>
              <View style={st.statRow}>
                <StatTile value={fmtHours(effort.estimated)} label="Estimated" />
                <StatTile value={fmtHours(effort.completed)} label="Completed" color="#10B981" />
                <StatTile value={fmtHours(effort.remaining)} label="Remaining" color="#F59E0B" />
                <StatTile value={fmtHours(effort.logged)} label="Logged" color="#0EA5E9" />
              </View>
              <View style={{ marginTop: 14 }}>
                <ProgressBar
                  pct={effort.estimated ? (effort.completed / effort.estimated) * 100 : 0}
                  color={T.primary}
                />
              </View>
              <Text style={st.foot}>
                {effort.pointsClosed ?? 0} of {effort.pointsTotal ?? 0} story points delivered
              </Text>
            </View>

            {/* State donut */}
            <View style={st.card}>
              <Text style={st.cardTitle}>STATE DISTRIBUTION</Text>
              <Text style={st.cardSub}>Where the work currently sits</Text>
              <View style={st.donutRow}>
                <View style={st.donutWrap}>
                  <Donut data={stateDonut} />
                  <View style={st.donutCenter}>
                    <Text style={st.donutNum}>{stateTotal}</Text>
                    <Text style={st.donutLabel}>items</Text>
                  </View>
                </View>
                <View style={{ flex: 1, gap: 9 }}>
                  {stateDonut.map((d: any) => (
                    <View key={d.label} style={st.legendRow}>
                      <View style={[st.legendDot, { backgroundColor: d.color }]} />
                      <Text style={st.legendLabel}>{d.label}</Text>
                      <Text style={st.legendPct}>{stateTotal ? Math.round((d.value / stateTotal) * 100) : 0}%</Text>
                      <Text style={st.legendVal}>{d.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Type breakdown */}
            <View style={st.card}>
              <Text style={st.cardTitle}>BY WORK ITEM TYPE</Text>
              <Text style={st.cardSub}>Closed vs total per type</Text>
              {(report.byType ?? []).map((t: any) => {
                const meta = TYPE_META[t.type as WorkItemType];
                const pct = t.count ? Math.round((t.closed / t.count) * 100) : 0;
                return (
                  <View key={t.type} style={st.barRow}>
                    <Text style={[st.barLabel, { color: meta.fg }]}>{meta.label}</Text>
                    <View style={{ flex: 1 }}>
                      <ProgressBar pct={pct} color={meta.solid} height={8} />
                    </View>
                    <Text style={st.barVal}>{t.closed}/{t.count}</Text>
                  </View>
                );
              })}
            </View>

            {/* Priority */}
            <View style={st.card}>
              <Text style={st.cardTitle}>OPEN WORK BY PRIORITY</Text>
              <Text style={st.cardSub}>P1 is the most urgent</Text>
              {(report.byPriority ?? []).map((p: any) => {
                const meta = PRIORITY_META[p.priority] ?? PRIORITY_META[2];
                const pct = p.count ? Math.round((p.open / p.count) * 100) : 0;
                return (
                  <View key={p.priority} style={st.barRow}>
                    <Text style={[st.barLabel, { color: meta.fg }]}>{meta.label}</Text>
                    <View style={{ flex: 1 }}>
                      <ProgressBar pct={pct} color={meta.solid} height={8} />
                    </View>
                    <Text style={st.barVal}>{p.open}/{p.count}</Text>
                  </View>
                );
              })}
            </View>

            {/* Velocity */}
            {(report.velocity ?? []).length > 0 && (
              <View style={st.card}>
                <Text style={st.cardTitle}>VELOCITY</Text>
                <Text style={st.cardSub}>Committed vs completed per sprint</Text>
                <VelocityChart data={report.velocity.map((v: any) => ({ name: v.name, committed: v.committed, completed: v.completed }))} />
                {report.velocity.map((v: any) => (
                  <TouchableOpacity
                    key={v.sprintId}
                    style={st.velRow}
                    activeOpacity={0.8}
                    onPress={() => navigation?.navigate('SprintDetail', { sprintId: v.sprintId, projectId, projectKey })}
                  >
                    <Text style={st.velName} numberOfLines={1}>{v.name}</Text>
                    <Text style={st.velVal}>{v.itemsClosed}/{v.itemsTotal} items</Text>
                    <Text style={st.velVal}>{v.completed}/{v.committed} pts</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Weekly effort */}
            {(report.weeklyEffort ?? []).length > 0 && (
              <View style={st.card}>
                <Text style={st.cardTitle}>HOURS LOGGED PER WEEK</Text>
                <Text style={st.cardSub}>Last 8 weeks, week beginning</Text>
                <ColumnChart
                  values={report.weeklyEffort.map((w: any) => w.hours)}
                  labels={report.weeklyEffort.map((w: any) => w.label)}
                />
              </View>
            )}

            {/* By team */}
            {(report.byTeam ?? []).length > 0 && (
              <View style={st.card}>
                <Text style={st.cardTitle}>BY TEAM</Text>
                <Text style={st.cardSub}>Delivery and effort per squad</Text>
                {report.byTeam.map((t: any) => (
                  <TouchableOpacity
                    key={t.teamId}
                    style={st.teamRow}
                    activeOpacity={0.8}
                    onPress={() => navigation?.navigate('TeamDetail', { teamId: t.teamId, projectId, projectKey })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={st.teamName} numberOfLines={1}>{t.name}</Text>
                      <Text style={st.teamSub} numberOfLines={1}>
                        {t.managerName || 'No manager'} · {fmtHours(t.hoursLogged)} logged · {fmtHours(t.remaining)} left
                      </Text>
                      <View style={{ marginTop: 6 }}>
                        <ProgressBar pct={t.progress} height={6} />
                      </View>
                    </View>
                    <Text style={st.teamPct}>{t.progress}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={st.generated}>Generated {new Date(report.generatedAt).toLocaleString('en-GB')}</Text>
          </>
        ) : (
          <>
            {people.length === 0 ? (
              <EmptyState icon="users" title="No contributors yet" subtitle="Assign work items or log time to build individual reports." />
            ) : (
              <>
                <Text style={st.hint}>
                  Ranked by hours logged. Tap anyone to see their full contribution — items, time entries and completion.
                </Text>
                {people.map((p, idx) => (
                  <TouchableOpacity
                    key={p.employeeId}
                    style={st.personCard}
                    activeOpacity={0.85}
                    onPress={() => navigation?.navigate('MemberReport', { projectId, employeeId: p.employeeId, name: p.name, projectKey })}
                  >
                    <View style={st.personTop}>
                      <Text style={st.rank}>{idx + 1}</Text>
                      <Avatar name={p.name} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={st.personName} numberOfLines={1}>{p.name}</Text>
                        <Text style={st.personRole} numberOfLines={1}>
                          {p.role || 'Contributor'}{p.teamName ? ` · ${p.teamName}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={st.personHours}>{fmtHours(p.hoursLogged)}</Text>
                        <Text style={st.personShare}>{p.effortSharePct}% of effort</Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 12 }}>
                      <ProgressBar pct={p.completionPct} />
                    </View>

                    <View style={st.personGrid}>
                      <Metric label="Assigned" value={p.assigned} />
                      <Metric label="Closed" value={p.closed} color="#10B981" />
                      <Metric label="Active" value={p.active} color="#2563EB" />
                      <Metric label="Overdue" value={p.overdue} color={p.overdue ? '#EF4444' : T.sub} />
                    </View>
                    <View style={st.personGrid}>
                      <Metric label="Points" value={p.storyPoints} color="#7C3AED" />
                      <Metric label="Days engaged" value={p.daysEngaged} />
                      <Metric label="Avg hrs/day" value={p.avgHoursPerDay} />
                      <Metric label="On time" value={`${p.onTimePct}%`} color="#10B981" />
                    </View>
                    <Text style={st.personFoot}>
                      {fmtHours(p.actual)} booked against {fmtHours(p.estimated)} estimated
                      {p.estimateAccuracyPct ? ` (${p.estimateAccuracyPct}% of estimate)` : ''}
                      {p.avgCycleDays ? ` · closes in ${p.avgCycleDays} days on average` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Metric({ label, value, color = T.ink }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={st.metric}>
      <Text style={[st.metricVal, { color }]}>{value}</Text>
      <Text style={st.metricLabel}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', backgroundColor: T.card, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: T.line },
  tab: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: '#F3F4F6' },
  tabOn: { backgroundColor: T.primary },
  tabTx: { fontSize: 12.5, fontWeight: '700', color: T.sub },
  tabTxOn: { color: '#FFF' },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },

  card: {
    backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 14, marginTop: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardTitle: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.8 },
  cardSub: { fontSize: 11.5, color: T.faint, marginTop: 2, marginBottom: 12 },
  foot: { fontSize: 11.5, color: T.sub, marginTop: 10 },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  donutWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutNum: { fontSize: 22, fontWeight: '800', color: T.ink },
  donutLabel: { fontSize: 10.5, color: T.sub },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 12.5, color: T.ink },
  legendPct: { fontSize: 11.5, color: T.sub, width: 34, textAlign: 'right' },
  legendVal: { fontSize: 12.5, fontWeight: '800', color: T.ink, width: 26, textAlign: 'right' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  barLabel: { width: 78, fontSize: 11.5, fontWeight: '700' },
  barVal: { width: 48, textAlign: 'right', fontSize: 11.5, fontWeight: '700', color: T.ink },

  velRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  velName: { flex: 1, fontSize: 12.5, fontWeight: '700', color: T.ink },
  velVal: { fontSize: 11.5, color: T.sub, fontWeight: '600' },

  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  teamName: { fontSize: 13, fontWeight: '700', color: T.ink },
  teamSub: { fontSize: 10.5, color: T.sub, marginTop: 2 },
  teamPct: { fontSize: 15, fontWeight: '800', color: T.primary },

  generated: { fontSize: 10.5, color: T.faint, textAlign: 'center', marginTop: 4 },
  hint: { fontSize: 11.5, color: T.sub, marginBottom: 12, lineHeight: 17 },

  personCard: {
    backgroundColor: T.card, borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { width: 16, fontSize: 12, fontWeight: '800', color: T.faint },
  personName: { fontSize: 14, fontWeight: '800', color: T.ink },
  personRole: { fontSize: 11, color: T.sub, marginTop: 2 },
  personHours: { fontSize: 15, fontWeight: '800', color: T.primary },
  personShare: { fontSize: 10, color: T.sub, marginTop: 2 },
  personGrid: { flexDirection: 'row', marginTop: 10 },
  metric: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: 14.5, fontWeight: '800' },
  metricLabel: { fontSize: 9.5, color: T.sub, marginTop: 2 },
  personFoot: { fontSize: 11, color: T.sub, marginTop: 12, lineHeight: 16 },
});
