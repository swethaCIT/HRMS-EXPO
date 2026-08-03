import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { employeeApi, projectApi, workItemApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';
import { Avatar, BoardHeader } from './components';
import { ALLOWED_CHILDREN, T, TYPE_META, WorkItemType } from './boardTheme';

const TYPES: WorkItemType[] = ['epic', 'feature', 'user_story', 'task', 'bug'];

/** Target-date presets — a full date picker is overkill for planning on a phone. */
const DATE_PRESETS: { label: string; days: number | null }[] = [
  { label: 'None', days: null },
  { label: '+3 days', days: 3 },
  { label: '+1 week', days: 7 },
  { label: '+2 weeks', days: 14 },
  { label: '+1 month', days: 30 },
];

const isoInDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Create an epic, feature, user story, task or bug on a project board. */
export default function CreateWorkItemScreen({ route, navigation }: any) {
  const projectId: string = route?.params?.projectId;
  const projectKey: string | undefined = route?.params?.projectKey;
  const parentId: string | undefined = route?.params?.parentId;
  const parentType: WorkItemType | undefined = route?.params?.parentType;
  const parentTitle: string | undefined = route?.params?.parentTitle;

  // A child's type is constrained by its parent, exactly like the backend rule.
  const allowedTypes = parentType ? ALLOWED_CHILDREN[parentType] : TYPES;

  const [type, setType] = useState<WorkItemType>(allowedTypes[0] ?? 'task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(2);
  const [points, setPoints] = useState('');
  const [estimate, setEstimate] = useState('');
  const [targetDays, setTargetDays] = useState<number | null>(7);
  const [assignee, setAssignee] = useState<{ id: string; name: string } | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [sprintId, setSprintId] = useState<string | null>(null);

  const [teams, setTeams] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const { data } = await projectApi.getOne(projectId);
      setTeams(data?.teams ?? []);
      setSprints(data?.sprints ?? []);
      setTeamId(data?.teams?.[0]?.id ?? null);
      setSprintId(data?.currentSprint?.id ?? null);

      // Prefer the squad roster; fall back to the company directory so an item
      // can still be assigned before the teams are filled in.
      const roster = (data?.teams ?? []).flatMap((t: any) =>
        (t.members ?? []).map((m: any) => ({ id: m.employeeId, name: m.name })),
      );
      const unique = [...new Map(roster.map((p: any) => [p.id, p])).values()] as { id: string; name: string }[];
      if (unique.length) {
        setPeople(unique);
        return;
      }
    } catch { /* fall through to the directory */ }

    try {
      const { data } = await employeeApi.getAll();
      if (Array.isArray(data)) {
        setPeople(data.map((e: any) => ({ id: e.id, name: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.employeeId })));
      }
    } catch { /* assignment stays optional */ }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const teamName = useMemo(() => teams.find((t) => t.id === teamId)?.name, [teams, teamId]);

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give the work item a short, clear title.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        projectId,
        type,
        title: title.trim(),
        priority,
      };
      if (description.trim()) payload.description = description.trim();
      if (parentId) payload.parentId = parentId;
      if (teamId) payload.teamId = teamId;
      if (sprintId) payload.sprintId = sprintId;
      if (assignee) {
        payload.assigneeId = assignee.id;
        payload.assigneeName = assignee.name;
      }
      if (Number(points) > 0) payload.storyPoints = Number(points);
      if (Number(estimate) > 0) payload.originalEstimate = Number(estimate);
      if (targetDays != null) payload.targetDate = isoInDays(targetDays);

      const { data } = await workItemApi.create(payload);
      navigation?.replace('WorkItemDetail', { id: data.id, projectKey });
    } catch (err) {
      Alert.alert('Could not create work item', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={st.root}>
      <BoardHeader
        title="New work item"
        subtitle={parentTitle ? `Child of ${parentTitle}` : projectKey || 'Project board'}
        navigation={navigation}
      />

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Type */}
        <Text style={st.label}>TYPE</Text>
        <View style={st.chipWrap}>
          {allowedTypes.map((t) => {
            const meta = TYPE_META[t];
            const on = type === t;
            return (
              <TouchableOpacity
                key={t}
                style={[st.typeChip, { backgroundColor: on ? meta.solid : meta.bg }]}
                onPress={() => setType(t)}
                activeOpacity={0.85}
              >
                <Text style={[st.typeChipTx, { color: on ? '#FFF' : meta.fg }]}>{meta.glyph} {meta.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Title + description */}
        <Text style={st.label}>TITLE</Text>
        <TextInput
          style={st.input}
          value={title}
          onChangeText={setTitle}
          placeholder={type === 'user_story' ? 'As a … I want … so that …' : 'Short summary of the work'}
          placeholderTextColor={T.faint}
        />

        <Text style={st.label}>DESCRIPTION</Text>
        <TextInput
          style={[st.input, { height: 92, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Acceptance criteria, context, links…"
          placeholderTextColor={T.faint}
        />

        {/* Priority */}
        <Text style={st.label}>PRIORITY</Text>
        <View style={st.chipWrap}>
          {[1, 2, 3, 4].map((p) => {
            const on = priority === p;
            return (
              <TouchableOpacity key={p} style={[st.chip, on && st.chipOn]} onPress={() => setPriority(p)} activeOpacity={0.85}>
                <Text style={[st.chipTx, on && st.chipTxOn]}>P{p}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Effort */}
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>STORY POINTS</Text>
            <TextInput style={st.input} value={points} onChangeText={setPoints} keyboardType="number-pad" placeholder="0" placeholderTextColor={T.faint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>ESTIMATE (HRS)</Text>
            <TextInput style={st.input} value={estimate} onChangeText={setEstimate} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={T.faint} />
          </View>
        </View>

        {/* Target date */}
        <Text style={st.label}>TARGET DATE</Text>
        <View style={st.chipWrap}>
          {DATE_PRESETS.map((d) => {
            const on = targetDays === d.days;
            return (
              <TouchableOpacity key={d.label} style={[st.chip, on && st.chipOn]} onPress={() => setTargetDays(d.days)} activeOpacity={0.85}>
                <Text style={[st.chipTx, on && st.chipTxOn]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {targetDays != null && <Text style={st.hint}>Due {isoInDays(targetDays)}</Text>}

        {/* Assignee */}
        <Text style={st.label}>ASSIGNED TO</Text>
        <View style={st.chipWrap}>
          <TouchableOpacity style={[st.chip, !assignee && st.chipOn]} onPress={() => setAssignee(null)} activeOpacity={0.85}>
            <Text style={[st.chipTx, !assignee && st.chipTxOn]}>Unassigned</Text>
          </TouchableOpacity>
          {people.map((p) => {
            const on = assignee?.id === p.id;
            return (
              <TouchableOpacity key={p.id} style={[st.personChip, on && st.chipOn]} onPress={() => setAssignee(p)} activeOpacity={0.85}>
                <Avatar name={p.name} size={20} />
                <Text style={[st.chipTx, on && st.chipTxOn]} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Team */}
        {teams.length > 0 && (
          <>
            <Text style={st.label}>TEAM</Text>
            <View style={st.chipWrap}>
              {teams.map((t) => {
                const on = teamId === t.id;
                return (
                  <TouchableOpacity key={t.id} style={[st.chip, on && st.chipOn]} onPress={() => setTeamId(t.id)} activeOpacity={0.85}>
                    <Text style={[st.chipTx, on && st.chipTxOn]}>{t.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Sprint */}
        {sprints.length > 0 && (
          <>
            <Text style={st.label}>ITERATION</Text>
            <View style={st.chipWrap}>
              <TouchableOpacity style={[st.chip, !sprintId && st.chipOn]} onPress={() => setSprintId(null)} activeOpacity={0.85}>
                <Text style={[st.chipTx, !sprintId && st.chipTxOn]}>Backlog</Text>
              </TouchableOpacity>
              {sprints.map((s) => {
                const on = sprintId === s.id;
                return (
                  <TouchableOpacity key={s.id} style={[st.chip, on && st.chipOn]} onPress={() => setSprintId(s.id)} activeOpacity={0.85}>
                    <Text style={[st.chipTx, on && st.chipTxOn]}>{s.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text style={st.summary}>
          {TYPE_META[type].label}
          {parentTitle ? ` under “${parentTitle}”` : ''}
          {teamName ? ` · ${teamName}` : ''}
          {assignee ? ` · ${assignee.name}` : ' · unassigned'}
        </Text>

        <TouchableOpacity style={st.submit} onPress={submit} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={st.submitTx}>Create {TYPE_META[type].label}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  label: { fontSize: 11, fontWeight: '800', color: T.sub, letterSpacing: 0.8, marginBottom: 8, marginTop: 6 },
  hint: { fontSize: 11.5, color: T.faint, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 12 },

  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: T.ink, backgroundColor: T.card, marginBottom: 8,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 8 },
  personChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: 16, paddingHorizontal: 8, paddingVertical: 5, maxWidth: 190,
  },
  chipOn: { backgroundColor: T.primary, borderColor: T.primary },
  chipTx: { fontSize: 12.5, fontWeight: '700', color: T.sub },
  chipTxOn: { color: '#FFF' },

  typeChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  typeChipTx: { fontSize: 12.5, fontWeight: '800' },

  summary: { fontSize: 12, color: T.sub, marginTop: 14, marginBottom: 12, lineHeight: 18 },
  submit: { backgroundColor: T.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  submitTx: { color: '#FFF', fontSize: 14.5, fontWeight: '800' },
});
