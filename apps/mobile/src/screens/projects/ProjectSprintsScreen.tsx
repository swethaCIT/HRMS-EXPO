import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { managementKind } from '../../store/slices/authSlice';
import { projectApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import { getErrorMessage } from '../../utils/errorMessage';
import Icon from '../../components/Icon';
import { BoardHeader, EmptyState, OfflineNote } from './components';
import { ProgressBar } from './charts';
import { fmtDate, fmtHours, relativeDays, SPRINT_STATUS_META, SprintStatus, T } from './boardTheme';

const LENGTHS = [1, 2, 3, 4];

const isoInDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Iteration list — every sprint with its completion, plus creating a new one. */
export default function ProjectSprintsScreen({ route, navigation }: any) {
  const projectId: string = route?.params?.projectId;
  const projectKey: string | undefined = route?.params?.projectKey;
  const role = useSelector((s: RootState) => s.auth.user?.role);
  const canManage = !!managementKind(role);

  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [weeks, setWeeks] = useState(2);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const { data } = await projectApi.sprints(projectId);
      setSprints(Array.isArray(data) ? data : []);
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

  const create = async () => {
    const label = name.trim() || `${projectKey || 'Sprint'} Sprint ${sprints.length + 1}`;
    setSaving(true);
    try {
      // A new sprint starts the day after the last one ends, so iterations queue
      // up back-to-back instead of overlapping.
      const lastEnd = sprints.length
        ? sprints.map((s) => new Date(s.endDate).getTime()).sort((a, b) => b - a)[0]
        : null;
      const startOffset = lastEnd ? Math.max(0, Math.ceil((lastEnd - Date.now()) / 86400000) + 1) : 0;
      const payload: Record<string, any> = {
        name: label,
        startDate: isoInDays(startOffset),
        endDate: isoInDays(startOffset + weeks * 7 - 1),
      };
      if (goal.trim()) payload.goal = goal.trim();
      await projectApi.createSprint(projectId, payload);
      setName('');
      setGoal('');
      setFormOpen(false);
      await load();
    } catch (err) {
      Alert.alert('Could not create sprint', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={st.root}>
      <BoardHeader
        title="Iterations"
        subtitle={`${projectKey || 'Project'} · ${sprints.length} sprint${sprints.length === 1 ? '' : 's'}`}
        navigation={navigation}
        right={
          canManage ? (
            <TouchableOpacity style={st.addBtn} onPress={() => setFormOpen((v) => !v)} activeOpacity={0.85}>
              <Text style={st.addBtnTx}>{formOpen ? 'Close' : '+ New'}</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

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

          {formOpen && (
            <View style={st.card}>
              <Text style={st.cardTitle}>NEW SPRINT</Text>
              <Text style={st.label}>NAME</Text>
              <TextInput
                style={st.input}
                value={name}
                onChangeText={setName}
                placeholder={`${projectKey || 'Sprint'} Sprint ${sprints.length + 1}`}
                placeholderTextColor={T.faint}
              />
              <Text style={st.label}>SPRINT GOAL</Text>
              <TextInput
                style={[st.input, { height: 64, textAlignVertical: 'top' }]}
                value={goal}
                onChangeText={setGoal}
                multiline
                placeholder="What should be true when this sprint ends?"
                placeholderTextColor={T.faint}
              />
              <Text style={st.label}>LENGTH</Text>
              <View style={st.chipWrap}>
                {LENGTHS.map((w) => {
                  const on = weeks === w;
                  return (
                    <TouchableOpacity key={w} style={[st.chip, on && st.chipOn]} onPress={() => setWeeks(w)} activeOpacity={0.85}>
                      <Text style={[st.chipTx, on && st.chipTxOn]}>{w} week{w === 1 ? '' : 's'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={st.submit} onPress={create} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={st.submitTx}>Create sprint</Text>}
              </TouchableOpacity>
            </View>
          )}

          {sprints.length === 0 && !formOpen ? (
            <EmptyState
              icon="calendar"
              title="No iterations yet"
              subtitle={canManage ? 'Create a sprint to start tracking a burndown.' : 'The team has not planned any sprints.'}
            />
          ) : (
            sprints.map((s) => {
              const meta = SPRINT_STATUS_META[s.status as SprintStatus] ?? SPRINT_STATUS_META.future;
              const current = s.status === 'current';
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[st.sprintCard, current && st.sprintCardCurrent]}
                  activeOpacity={0.85}
                  onPress={() => navigation?.navigate('SprintDetail', { sprintId: s.id, projectId, projectKey })}
                >
                  <View style={st.sprintTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.sprintName} numberOfLines={1}>{s.name}</Text>
                      <Text style={st.sprintDates}>
                        {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
                        {current ? ` · ends ${relativeDays(s.endDate)}` : ''}
                      </Text>
                    </View>
                    <View style={[st.statusChip, { backgroundColor: meta.bg }]}>
                      <Text style={[st.statusChipTx, { color: meta.fg }]}>{meta.label}</Text>
                    </View>
                  </View>

                  {!!s.goal && <Text style={st.goal} numberOfLines={2}>{s.goal}</Text>}

                  <View style={st.progressRow}>
                    <Text style={st.progressPct}>{s.progress}%</Text>
                    <View style={{ flex: 1 }}>
                      <ProgressBar pct={s.progress} color={current ? T.primary : '#A5B4FC'} height={6} />
                    </View>
                    <Text style={st.progressCount}>{s.itemsClosed}/{s.itemsTotal}</Text>
                  </View>

                  <View style={st.metaRow}>
                    <Text style={st.metaTx}>{s.pointsClosed}/{s.pointsTotal} pts</Text>
                    <Text style={st.metaTx}>{fmtHours(s.completed)} done</Text>
                    <Text style={st.metaTx}>{fmtHours(s.remaining)} left</Text>
                    <View style={{ flex: 1 }} />
                    <Icon name="chevron-right" size={16} color={T.faint} />
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

  addBtn: { backgroundColor: T.primary, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 },
  addBtnTx: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  card: {
    backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardTitle: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.8, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '800', color: T.sub, letterSpacing: 0.8, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: T.ink, backgroundColor: '#FFF',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 7 },
  chipOn: { backgroundColor: T.primary },
  chipTx: { fontSize: 12.5, fontWeight: '700', color: T.sub },
  chipTxOn: { color: '#FFF' },
  submit: { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  submitTx: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  sprintCard: {
    backgroundColor: T.card, borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  sprintCardCurrent: { borderLeftWidth: 3, borderLeftColor: T.primary },
  sprintTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sprintName: { fontSize: 14.5, fontWeight: '800', color: T.ink },
  sprintDates: { fontSize: 11, color: T.sub, marginTop: 2 },
  statusChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusChipTx: { fontSize: 10, fontWeight: '800' },
  goal: { fontSize: 12.5, color: T.sub, marginTop: 10, lineHeight: 18 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  progressPct: { width: 36, fontSize: 12.5, fontWeight: '800', color: T.ink },
  progressCount: { width: 44, textAlign: 'right', fontSize: 11, color: T.sub },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  metaTx: { fontSize: 11, color: T.sub, fontWeight: '600' },
});
