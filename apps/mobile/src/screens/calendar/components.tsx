/* Small shared building blocks for the Team Calendar screens. */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { avatarColor, initialsOf } from '../../data/managerData';
import Icon from '../../components/Icon';
import { EventStatus, MeetingMode, ResponseStatus } from '../../types/calendar';
import { EVENT_STATUS_META, MODE_META, RSVP_META, T } from './calendarTheme';

/* ── Indigo screen header with a back arrow, matching the rest of the app ── */
export function CalendarHeader({
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

export function ModeBadge({ mode, compact }: { mode: MeetingMode; compact?: boolean }) {
  const meta = MODE_META[mode];
  return (
    <View style={[st.pill, { backgroundColor: meta.bg }]}>
      <Icon name={meta.icon} size={11} color={meta.fg} strokeWidth={2.4} />
      {!compact && <Text style={[st.pillTx, { color: meta.fg }]}>{meta.label}</Text>}
    </View>
  );
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const meta = EVENT_STATUS_META[status];
  return (
    <View style={[st.pill, { backgroundColor: meta.bg }]}>
      <View style={[st.dot, { backgroundColor: meta.solid }]} />
      <Text style={[st.pillTx, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

export function RsvpBadge({ status }: { status: ResponseStatus }) {
  const meta = RSVP_META[status];
  return (
    <View style={[st.pill, { backgroundColor: meta.bg }]}>
      <Text style={[st.pillTx, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 28 }: { name?: string | null; size?: number }) {
  const label = name || '?';
  const assigned = !!name;
  return (
    <View
      style={[
        st.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: assigned ? avatarColor(label) : '#E5E7EB' },
      ]}
    >
      <Text style={[st.avatarTx, { fontSize: size * 0.38 }]}>{assigned ? initialsOf(label) : '?'}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'calendar', title, subtitle, cta, onPressCta }: {
  icon?: any; title: string; subtitle?: string; cta?: string; onPressCta?: () => void;
}) {
  return (
    <View style={st.empty}>
      <Icon name={icon} size={40} color={T.faint} />
      <Text style={st.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={st.emptySub}>{subtitle}</Text>}
      {!!cta && (
        <TouchableOpacity style={st.emptyCta} onPress={onPressCta} activeOpacity={0.85}>
          <Text style={st.emptyCtaTx}>{cta}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ConflictBanner({ text }: { text: string }) {
  return (
    <View style={st.conflict}>
      <View style={st.conflictDot} />
      <Text style={st.conflictTx}>{text}</Text>
    </View>
  );
}

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
  pillTx: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#FFF', fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: T.ink },
  emptySub: { fontSize: 12.5, color: T.faint, textAlign: 'center', paddingHorizontal: 40 },
  emptyCta: { marginTop: 8, backgroundColor: T.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22 },
  emptyCtaTx: { color: '#FFF', fontSize: 13.5, fontWeight: '700' },

  conflict: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: T.amber.bg,
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 10,
  },
  conflictDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.amber.solid, marginTop: 4 },
  conflictTx: { flex: 1, fontSize: 12, color: T.amber.fg, fontWeight: '600', lineHeight: 17 },

  offline: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.amber.bg,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14,
  },
  offlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.amber.solid },
  offlineTx: { fontSize: 12, color: T.amber.fg, fontWeight: '600' },
});
