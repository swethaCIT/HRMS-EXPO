import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { employeeApi, projectApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';
import { Avatar, BoardHeader } from './components';
import { T } from './boardTheme';

const ROLES = ['Tech Lead', 'Developer', 'QA', 'Designer', 'Product Owner', 'DevOps', 'Analyst'];

interface Person { id: string; name: string; designation?: string }

/** Create a squad on a project: name it, pick its manager and its members. */
export default function CreateTeamScreen({ route, navigation }: any) {
  const projectId: string = route?.params?.projectId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [manager, setManager] = useState<Person | null>(null);
  const [members, setMembers] = useState<Record<string, string>>({}); // employeeId → role
  const [people, setPeople] = useState<Person[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await employeeApi.getAll();
        if (Array.isArray(data)) {
          setPeople(
            data.map((e: any) => ({
              id: e.id,
              name: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.employeeId,
              designation: e.designation,
            })),
          );
        }
      } catch {
        Alert.alert('Directory unavailable', 'Could not load the employee list. You can still create the team and add members later.');
      }
    })();
  }, []);

  const toggleMember = (p: Person) =>
    setMembers((cur) => {
      const next = { ...cur };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = 'Developer';
      return next;
    });

  const cycleRole = (id: string) =>
    setMembers((cur) => {
      const idx = ROLES.indexOf(cur[id]);
      return { ...cur, [id]: ROLES[(idx + 1) % ROLES.length] };
    });

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the team a name, e.g. “Payments Core”.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = { name: name.trim() };
      if (description.trim()) payload.description = description.trim();
      if (manager) {
        payload.managerEmployeeId = manager.id;
        payload.managerName = manager.name;
      }
      const { data: team } = await projectApi.createTeam(projectId, payload);

      // Members are added one by one — the API validates each against the squad.
      const failed: string[] = [];
      for (const [employeeId, role] of Object.entries(members)) {
        const person = people.find((p) => p.id === employeeId);
        try {
          await projectApi.addMember(team.id, { employeeId, name: person?.name ?? 'Team member', role });
        } catch {
          failed.push(person?.name ?? employeeId);
        }
      }
      if (failed.length) Alert.alert('Team created', `Could not add: ${failed.join(', ')}`);
      navigation?.replace('TeamDetail', { teamId: team.id, projectId });
    } catch (err) {
      Alert.alert('Could not create team', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = Object.keys(members).length;

  return (
    <View style={st.root}>
      <BoardHeader title="New team" subtitle={route?.params?.name || 'Project squad'} navigation={navigation} />

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={st.label}>TEAM NAME</Text>
        <TextInput style={st.input} value={name} onChangeText={setName} placeholder="e.g. Payments Core" placeholderTextColor={T.faint} />

        <Text style={st.label}>WHAT THEY OWN</Text>
        <TextInput
          style={[st.input, { height: 76, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="e.g. Owns the payments API and the checkout flow"
          placeholderTextColor={T.faint}
        />

        <Text style={st.label}>TEAM MANAGER</Text>
        <View style={st.chipWrap}>
          <TouchableOpacity style={[st.chip, !manager && st.chipOn]} onPress={() => setManager(null)} activeOpacity={0.85}>
            <Text style={[st.chipTx, !manager && st.chipTxOn]}>None</Text>
          </TouchableOpacity>
          {people.map((p) => {
            const on = manager?.id === p.id;
            return (
              <TouchableOpacity key={p.id} style={[st.personChip, on && st.chipOn]} onPress={() => setManager(p)} activeOpacity={0.85}>
                <Avatar name={p.name} size={20} />
                <Text style={[st.chipTx, on && st.chipTxOn]} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={st.label}>MEMBERS · {selectedCount} selected</Text>
        <View style={st.card}>
          {people.length === 0 ? (
            <Text style={st.muted}>No employees loaded.</Text>
          ) : (
            people.map((p, i) => {
              const on = !!members[p.id];
              return (
                <View key={p.id} style={[st.memberRow, i < people.length - 1 && st.divider]}>
                  <TouchableOpacity style={st.memberLeft} onPress={() => toggleMember(p)} activeOpacity={0.8}>
                    <View style={[st.checkbox, on && st.checkboxOn]}>{on && <Text style={st.checkTx}>✓</Text>}</View>
                    <Avatar name={p.name} size={30} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.memberName} numberOfLines={1}>{p.name}</Text>
                      <Text style={st.memberSub} numberOfLines={1}>{p.designation || 'Employee'}</Text>
                    </View>
                  </TouchableOpacity>
                  {on && (
                    <TouchableOpacity style={st.roleChip} onPress={() => cycleRole(p.id)} activeOpacity={0.8}>
                      <Text style={st.roleChipTx}>{members[p.id]}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
        <Text style={st.hint}>Tap a role chip to cycle through Tech Lead / Developer / QA / …</Text>

        <TouchableOpacity style={st.submit} onPress={submit} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={st.submitTx}>Create team</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  label: { fontSize: 11, fontWeight: '800', color: T.sub, letterSpacing: 0.8, marginBottom: 8, marginTop: 6 },
  hint: { fontSize: 11.5, color: T.faint, marginTop: 6, marginBottom: 16 },
  muted: { fontSize: 12.5, color: T.sub },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: T.ink, backgroundColor: T.card, marginBottom: 6,
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

  card: { backgroundColor: T.card, borderRadius: 14, paddingHorizontal: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  memberLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: T.primary, borderColor: T.primary },
  checkTx: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  memberName: { fontSize: 13.5, fontWeight: '700', color: T.ink },
  memberSub: { fontSize: 11, color: T.sub, marginTop: 1 },
  roleChip: { backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  roleChipTx: { fontSize: 11, fontWeight: '700', color: T.primary },

  submit: { backgroundColor: T.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  submitTx: { color: '#FFF', fontSize: 14.5, fontWeight: '800' },
});
