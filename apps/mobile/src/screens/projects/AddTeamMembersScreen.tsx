import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, StatusBar,
  ActivityIndicator, Alert,
} from 'react-native';
import { employeeApi, projectApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';
import { T, avatarColor, initialsOf } from '../../data/managerData';
import Icon from '../../components/Icon';
import { ACCESS_META, ACCESS_ORDER, TeamAccessLevel } from './boardTheme';

interface Person {
  id: string;
  employeeId: string;
  name: string;
  department?: string;
  designation?: string;
}

const SQUAD_ROLES = ['Developer', 'QA', 'Designer', 'Tech Lead', 'Analyst'];

/**
 * Pick employees to add to a team, choosing the squad role and the access level
 * the manager wants to grant. Anyone already on the team is shown but locked,
 * so it's obvious why they can't be picked again.
 */
export default function AddTeamMembersScreen({ route, navigation }: any) {
  const teamId: string = route?.params?.teamId;
  const teamName: string = route?.params?.teamName ?? 'this team';
  const existingIds: string[] = route?.params?.existingIds ?? [];

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [role, setRole] = useState<string>('Developer');
  const [access, setAccess] = useState<TeamAccessLevel>('contribute');

  const alreadyOn = useMemo(() => new Set(existingIds), [existingIds]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await employeeApi.getAll();
        const rows = Array.isArray(data) ? data : data?.data ?? [];
        setPeople(
          rows.map((e: any) => ({
            id: e.id,
            employeeId: e.employeeId,
            name: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.employeeId,
            department: e.department,
            designation: e.designation,
          })),
        );
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load the employee directory'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.department ?? '').toLowerCase().includes(q) ||
        (p.designation ?? '').toLowerCase().includes(q) ||
        p.employeeId.toLowerCase().includes(q),
    );
  }, [people, query]);

  const selectedList = useMemo(() => people.filter((p) => selected[p.id]), [people, selected]);

  const toggle = useCallback((p: Person) => {
    if (alreadyOn.has(p.id)) return;
    setSelected((s) => ({ ...s, [p.id]: !s[p.id] }));
  }, [alreadyOn]);

  const save = async () => {
    if (!selectedList.length) return;
    setSaving(true);
    try {
      const { data } = await projectApi.addMembers(
        teamId,
        selectedList.map((p) => ({
          employeeId: p.id,
          name: p.name,
          role,
          accessLevel: access,
        })),
      );
      const added = data?.added?.length ?? 0;
      const skipped = data?.skipped ?? [];
      // Report partial success honestly rather than claiming everything worked.
      if (skipped.length) {
        Alert.alert(
          'Partly added',
          `${added} added to ${teamName}.\n\nSkipped:\n${skipped.map((s: any) => `• ${s.name} — ${s.reason}`).join('\n')}`,
          [{ text: 'OK', onPress: () => navigation?.goBack() }],
        );
      } else {
        navigation?.goBack();
      }
    } catch (err) {
      Alert.alert('Could not add members', getErrorMessage(err, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const renderPerson = ({ item }: { item: Person }) => {
    const on = !!selected[item.id];
    const locked = alreadyOn.has(item.id);
    return (
      <TouchableOpacity
        style={[s.row, locked && s.rowLocked]}
        activeOpacity={locked ? 1 : 0.8}
        onPress={() => toggle(item)}
      >
        <View style={[s.check, on && s.checkOn, locked && s.checkLocked]}>
          {on && <Text style={s.checkTx}>✓</Text>}
        </View>
        <View style={[s.avatar, { backgroundColor: avatarColor(item.name) }]}>
          <Text style={s.avatarTx}>{initialsOf(item.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          <Text style={s.sub} numberOfLines={1}>
            {[item.designation, item.department].filter(Boolean).join(' · ') || item.employeeId}
          </Text>
        </View>
        {locked && <Text style={s.onTeam}>On team</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={s.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backTx}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hTitle}>Add people</Text>
          <Text style={s.hSub} numberOfLines={1}>to {teamName}</Text>
        </View>
      </View>

      {/* Role + access apply to everyone selected in this batch */}
      <View style={s.optionsCard}>
        <Text style={s.optLabel}>SQUAD ROLE</Text>
        <View style={s.chipRow}>
          {SQUAD_ROLES.map((r) => (
            <TouchableOpacity key={r} style={[s.chip, role === r && s.chipOn]} onPress={() => setRole(r)} activeOpacity={0.8}>
              <Text style={[s.chipTx, role === r && s.chipTxOn]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.optLabel, { marginTop: 14 }]}>ACCESS THIS MANAGER GRANTS</Text>
        {ACCESS_ORDER.map((lvl) => {
          const meta = ACCESS_META[lvl];
          const on = access === lvl;
          return (
            <TouchableOpacity key={lvl} style={[s.accessRow, on && s.accessRowOn]} onPress={() => setAccess(lvl)} activeOpacity={0.85}>
              <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={[s.accessName, on && { color: meta.fg }]}>{meta.label}</Text>
                <Text style={s.accessBlurb}>{meta.blurb}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.searchWrap}>
        <Icon name="user" size={16} color={T.faint} />
        <TextInput
          style={s.search}
          placeholder="Search people…"
          placeholderTextColor={T.faint}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={T.primary} size="large" /></View>
      ) : error ? (
        <View style={s.center}><Text style={s.errorTx}>{error}</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          renderItem={renderPerson}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={s.empty}>No one matches “{query}”.</Text>}
        />
      )}

      {selectedList.length > 0 && (
        <View style={s.footer}>
          <Text style={s.footerCount}>{selectedList.length} selected · {ACCESS_META[access].label}</Text>
          <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.saveTx}>Add to team</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backTx: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  hTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  hSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 1 },

  optionsCard: {
    backgroundColor: T.card, margin: 16, marginBottom: 8, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  optLabel: { fontSize: 10.5, fontWeight: '800', color: T.faint, letterSpacing: 0.8, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F3F4F6' },
  chipOn: { backgroundColor: T.primary },
  chipTx: { fontSize: 12, fontWeight: '600', color: T.sub },
  chipTxOn: { color: '#FFF' },

  accessRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderRadius: 10, paddingHorizontal: 6 },
  accessRowOn: { backgroundColor: '#F5F5FF' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: T.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.primary },
  accessName: { fontSize: 13.5, fontWeight: '700', color: T.ink },
  accessBlurb: { fontSize: 11.5, color: T.sub, marginTop: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card,
    marginHorizontal: 16, marginBottom: 10, borderRadius: 10, paddingHorizontal: 12, height: 42,
  },
  search: { flex: 1, fontSize: 14, color: T.ink, padding: 0 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  rowLocked: { opacity: 0.5 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: T.primary, borderColor: T.primary },
  checkLocked: { backgroundColor: '#E5E7EB', borderColor: '#E5E7EB' },
  checkTx: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  name: { fontSize: 14, fontWeight: '600', color: T.ink },
  sub: { fontSize: 11.5, color: T.sub, marginTop: 1 },
  onTeam: { fontSize: 10.5, fontWeight: '700', color: T.faint },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTx: { color: T.red.fg, fontSize: 13, textAlign: 'center' },
  empty: { textAlign: 'center', color: T.faint, fontSize: 13, paddingTop: 30 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.card,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, flexDirection: 'row',
    alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: T.line,
  },
  footerCount: { flex: 1, fontSize: 12.5, fontWeight: '600', color: T.sub },
  saveBtn: { backgroundColor: T.primary, borderRadius: 10, paddingHorizontal: 20, height: 42, alignItems: 'center', justifyContent: 'center', minWidth: 130 },
  saveTx: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
