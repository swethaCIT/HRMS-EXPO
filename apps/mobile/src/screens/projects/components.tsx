/* Small shared building blocks for the board screens. */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { avatarColor, initialsOf, T } from '../../data/managerData';
import Icon from '../../components/Icon';
import { PRIORITY_META, STATE_META, TYPE_META, WorkItemState, WorkItemType } from './boardTheme';

/* ── Indigo screen header with a back arrow, matching the rest of the app ── */
export function BoardHeader({
  title,
  subtitle,
  navigation,
  right,
}: {
  title: string;
  subtitle?: string;
  navigation?: any;
  right?: React.ReactNode;
}) {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <TouchableOpacity
          style={st.backBtn}
          onPress={() => navigation?.canGoBack?.() && navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={st.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.hTitle} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={st.hSub} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right}
      </View>
    </>
  );
}

/** Work-item type pill — "Epic", "User Story", "Task"… */
export function TypeBadge({ type, compact }: { type: WorkItemType; compact?: boolean }) {
  const meta = TYPE_META[type];
  return (
    <View style={[st.pill, { backgroundColor: meta.bg }]}>
      <Text style={[st.pillGlyph, { color: meta.solid }]}>{meta.glyph}</Text>
      <Text style={[st.pillTx, { color: meta.fg }]}>{compact ? meta.short : meta.label}</Text>
    </View>
  );
}

/** Workflow-state pill — New / Active / Resolved / Closed / Removed. */
export function StateChip({ state }: { state: WorkItemState }) {
  const meta = STATE_META[state];
  return (
    <View style={[st.pill, { backgroundColor: meta.bg }]}>
      <View style={[st.dot, { backgroundColor: meta.solid }]} />
      <Text style={[st.pillTx, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

export function PriorityChip({ priority }: { priority: number }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META[2];
  return (
    <View style={[st.pillTight, { backgroundColor: meta.bg }]}>
      <Text style={[st.pillTx, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 28 }: { name?: string | null; size?: number }) {
  const label = name || 'Unassigned';
  const assigned = !!name;
  return (
    <View
      style={[
        st.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: assigned ? avatarColor(label) : '#E5E7EB',
        },
      ]}
    >
      <Text style={[st.avatarTx, { fontSize: size * 0.38 }]}>{assigned ? initialsOf(label) : '?'}</Text>
    </View>
  );
}

/** Key/value row used on the detail screens. */
export function FieldRow({ label, value, valueColor }: { label: string; value?: string | number | null; valueColor?: string }) {
  return (
    <View style={st.fieldRow}>
      <Text style={st.fieldLabel}>{label}</Text>
      <Text style={[st.fieldValue, valueColor ? { color: valueColor } : null]} numberOfLines={2}>
        {value === null || value === undefined || value === '' ? '—' : String(value)}
      </Text>
    </View>
  );
}

export function StatTile({ value, label, color = T.primary }: { value: string | number; label: string; color?: string }) {
  return (
    <View style={st.statTile}>
      <Text style={[st.statVal, { color }]}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'inbox', title, subtitle }: { icon?: any; title: string; subtitle?: string }) {
  return (
    <View style={st.empty}>
      <Icon name={icon} size={40} color={T.faint} />
      <Text style={st.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={st.emptySub}>{subtitle}</Text>}
    </View>
  );
}

/** Amber "backend unreachable" strip, same wording as the insight screens. */
export function OfflineNote({ text = 'Backend unreachable · pull down to retry' }: { text?: string }) {
  return (
    <View style={st.offline}>
      <View style={st.offlineDot} />
      <Text style={st.offlineTx}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  header: {
    backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backBtn: { width: 28 },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  hTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  hSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 2 },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3.5 },
  pillTight: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3.5 },
  pillTx: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  pillGlyph: { fontSize: 10 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#FFF', fontWeight: '800' },

  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9, gap: 12 },
  fieldLabel: { width: 118, fontSize: 12, color: T.sub },
  fieldValue: { flex: 1, fontSize: 13, fontWeight: '600', color: T.ink, textAlign: 'right' },

  statTile: { flex: 1, backgroundColor: T.card, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
  statVal: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 10.5, color: T.sub, marginTop: 3, textAlign: 'center' },

  empty: { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: T.ink },
  emptySub: { fontSize: 12.5, color: T.faint, textAlign: 'center', paddingHorizontal: 40 },

  offline: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.amber.bg,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14,
  },
  offlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.amber.solid },
  offlineTx: { fontSize: 12, color: T.amber.fg, fontWeight: '600' },
});
