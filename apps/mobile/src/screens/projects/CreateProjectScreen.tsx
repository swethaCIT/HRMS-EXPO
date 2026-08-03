import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { projectApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';
import { BoardHeader } from './components';
import { PROJECT_STATUS_META, ProjectStatus, T } from './boardTheme';

const COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#7C3AED', '#14B8A6', '#EF4444'];
const HORIZONS: { label: string; days: number }[] = [
  { label: '1 month', days: 30 },
  { label: '1 quarter', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
];

const isoInDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Managers/HR/admin create a project board here; it appears under Goals for everyone. */
export default function CreateProjectScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [color, setColor] = useState(COLORS[0]);
  const [horizon, setHorizon] = useState(90);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the project a name.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        status,
        color,
        startDate: new Date().toISOString().slice(0, 10),
        targetDate: isoInDays(horizon),
      };
      if (key.trim()) payload.key = key.trim().toUpperCase();
      if (description.trim()) payload.description = description.trim();
      const { data } = await projectApi.create(payload);
      navigation?.replace('ProjectDetail', { id: data.id, name: data.name });
    } catch (err) {
      Alert.alert('Could not create project', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={st.root}>
      <BoardHeader title="New project" subtitle="Create a board under Goals" navigation={navigation} />

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={st.label}>PROJECT NAME</Text>
        <TextInput
          style={st.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Atlas Payments Platform"
          placeholderTextColor={T.faint}
        />

        <Text style={st.label}>SHORT KEY</Text>
        <TextInput
          style={st.input}
          value={key}
          onChangeText={(t) => setKey(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={8}
          placeholder="ATLAS — used on cards as ATLAS-42"
          placeholderTextColor={T.faint}
        />
        <Text style={st.hint}>Leave blank and it is generated from the name.</Text>

        <Text style={st.label}>DESCRIPTION</Text>
        <TextInput
          style={[st.input, { height: 92, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="What is this project delivering?"
          placeholderTextColor={T.faint}
        />

        <Text style={st.label}>STATUS</Text>
        <View style={st.chipWrap}>
          {(Object.keys(PROJECT_STATUS_META) as ProjectStatus[]).map((s) => {
            const on = status === s;
            return (
              <TouchableOpacity key={s} style={[st.chip, on && st.chipOn]} onPress={() => setStatus(s)} activeOpacity={0.85}>
                <Text style={[st.chipTx, on && st.chipTxOn]}>{PROJECT_STATUS_META[s].label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={st.label}>TARGET HORIZON</Text>
        <View style={st.chipWrap}>
          {HORIZONS.map((h) => {
            const on = horizon === h.days;
            return (
              <TouchableOpacity key={h.label} style={[st.chip, on && st.chipOn]} onPress={() => setHorizon(h.days)} activeOpacity={0.85}>
                <Text style={[st.chipTx, on && st.chipTxOn]}>{h.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={st.hint}>Target date {isoInDays(horizon)}</Text>

        <Text style={st.label}>ACCENT COLOUR</Text>
        <View style={st.chipWrap}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[st.swatch, { backgroundColor: c }, color === c && st.swatchOn]}
              onPress={() => setColor(c)}
              activeOpacity={0.85}
            />
          ))}
        </View>

        <View style={[st.preview, { borderLeftColor: color }]}>
          <View style={[st.previewKey, { backgroundColor: color }]}>
            <Text style={st.previewKeyTx}>{(key || name || 'PRJ').slice(0, 5).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.previewName} numberOfLines={1}>{name || 'Project name'}</Text>
            <Text style={st.previewSub} numberOfLines={1}>{description || 'No description yet'}</Text>
          </View>
        </View>

        <TouchableOpacity style={st.submit} onPress={submit} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={st.submitTx}>Create project</Text>}
        </TouchableOpacity>

        <Text style={st.footNote}>Next: add teams and an iteration, then break the work down into epics, features, stories and tasks.</Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  label: { fontSize: 11, fontWeight: '800', color: T.sub, letterSpacing: 0.8, marginBottom: 8, marginTop: 6 },
  hint: { fontSize: 11.5, color: T.faint, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: T.ink, backgroundColor: T.card, marginBottom: 6,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 8 },
  chipOn: { backgroundColor: T.primary, borderColor: T.primary },
  chipTx: { fontSize: 12.5, fontWeight: '700', color: T.sub },
  chipTxOn: { color: '#FFF' },
  swatch: { width: 34, height: 34, borderRadius: 10, borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { borderColor: T.ink },

  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 14,
    padding: 14, borderLeftWidth: 4, marginTop: 8, marginBottom: 18,
  },
  previewKey: { width: 44, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewKeyTx: { color: '#FFF', fontSize: 10.5, fontWeight: '800' },
  previewName: { fontSize: 14.5, fontWeight: '800', color: T.ink },
  previewSub: { fontSize: 11.5, color: T.sub, marginTop: 2 },

  submit: { backgroundColor: T.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  submitTx: { color: '#FFF', fontSize: 14.5, fontWeight: '800' },
  footNote: { fontSize: 11.5, color: T.faint, textAlign: 'center', marginTop: 14, lineHeight: 17 },
});
