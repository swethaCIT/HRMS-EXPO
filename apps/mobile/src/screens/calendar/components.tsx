/* Small shared building blocks for the Calendar screens. */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Modal } from 'react-native';
import { avatarColor, initialsOf } from '../../data/managerData';
import Icon from '../../components/Icon';
import { EventStatus, HolidayType, MeetingMode, ResponseStatus } from '../../types/calendar';
import { EVENT_STATUS_META, HOLIDAY_TYPE_META, MODE_META, RSVP_META, T, calendarGrid, fmtMonthYear, isSameDay } from './calendarTheme';

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

export function HolidayTypeBadge({ type }: { type?: HolidayType | string }) {
  const meta = HOLIDAY_TYPE_META[type as HolidayType] ?? HOLIDAY_TYPE_META.public;
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

/** Bottom-sheet date picker (single-month calendar, tap a day to select) — shared by the meeting and holiday forms. */
export function DatePickerSheet({ visible, value, onSelect, onClose }: {
  visible: boolean; value: Date; onSelect: (d: Date) => void; onClose: () => void;
}) {
  const [y, setY] = useState(value.getFullYear());
  const [m, setM] = useState(value.getMonth());
  useEffect(() => { if (visible) { setY(value.getFullYear()); setM(value.getMonth()); } }, [visible, value]);
  const grid = useMemo(() => calendarGrid(y, m), [y, m]);
  const rows = Array.from({ length: 6 }, (_, i) => grid.slice(i * 7, i * 7 + 7));
  const today = new Date();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ps.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={ps.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={ps.handle} />
          <View style={ps.nav}>
            <TouchableOpacity onPress={() => (m === 0 ? (setM(11), setY(y - 1)) : setM(m - 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={ps.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={ps.navLabel}>{fmtMonthYear(y, m)}</Text>
            <TouchableOpacity onPress={() => (m === 11 ? (setM(0), setY(y + 1)) : setM(m + 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={ps.navArrow}>›</Text>
            </TouchableOpacity>
          </View>
          {rows.map((row, ri) => (
            <View key={ri} style={ps.row}>
              {row.map((cell, ci) => {
                const isSel = isSameDay(cell.date, value);
                const isToday = isSameDay(cell.date, today);
                return (
                  <TouchableOpacity key={ci} style={ps.cell} onPress={() => { onSelect(cell.date); onClose(); }} disabled={!cell.cur}>
                    <View style={[ps.circle, isSel && ps.circleSel, !isSel && isToday && ps.circleToday]}>
                      <Text style={[ps.dayTx, !cell.cur && ps.dayTxFaded, isSel && ps.dayTxSel]}>{cell.date.getDate()}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
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

const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: T.line, alignSelf: 'center', marginBottom: 14 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  navArrow: { fontSize: 24, color: T.ink, fontWeight: '600', paddingHorizontal: 8 },
  navLabel: { fontSize: 15, fontWeight: '700', color: T.ink },
  row: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  circleSel: { backgroundColor: T.primary },
  circleToday: { borderWidth: 1.5, borderColor: T.primary },
  dayTx: { fontSize: 13, color: T.ink },
  dayTxFaded: { color: '#D1D5DB' },
  dayTxSel: { color: '#FFF', fontWeight: '700' },
});
