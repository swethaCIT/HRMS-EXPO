import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchRange, setCurrentMonth, setSelectedDate } from '../../store/slices/calendarSlice';
import { useLivePolling } from '../../utils/useLivePolling';
import Icon from '../../components/Icon';
import { CalendarItem } from '../../types/calendar';
import { EmptyState, HolidayTypeBadge, ModeBadge } from './components';
import {
  T, calendarGrid, dateKeyOf, fmtMonthYear, fmtTimeRange, fmtWeekday, isSameDay,
  DOT_MEETING, DOT_HOLIDAY, MAX_DOTS_PER_DAY,
} from './calendarTheme';

const { width } = Dimensions.get('window');
const CELL = Math.floor((width - 32) / 7);
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function TeamCalendarScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { currentMonth, selectedDate, rangeCache, loading, error } = useSelector((s: RootState) => s.calendar);
  const role = useSelector((s: RootState) => s.auth.user?.role);
  const canManageHolidays = role === 'hr' || role === 'admin';

  const [yearStr, monthStr] = currentMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;

  const grid = useMemo(() => calendarGrid(year, month), [year, month]);
  const gridStart = grid[0].date;
  const gridEnd = grid[grid.length - 1].date;
  const rangeStartKey = dateKeyOf(gridStart);
  const rangeEndKey = dateKeyOf(gridEnd);
  const cacheKey = `${rangeStartKey}|${rangeEndKey}`;
  const items: CalendarItem[] = useMemo(() => rangeCache[cacheKey] ?? [], [rangeCache, cacheKey]);

  const load = useCallback(() => {
    dispatch(fetchRange({ start: rangeStartKey, end: rangeEndKey }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStartKey, rangeEndKey]);
  useLivePolling(load, 20_000);

  const itemsByDay = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    for (const it of items) {
      const key = dateKeyOf(new Date(it.startDateTime));
      (map[key] ??= []).push(it);
    }
    return map;
  }, [items]);

  const today = new Date();
  const selected = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;

  function goMonth(delta: number) {
    let y = year, m = month + delta;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    dispatch(setCurrentMonth(`${y}-${String(m + 1).padStart(2, '0')}`));
  }
  function goToday() {
    dispatch(setCurrentMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`));
    dispatch(setSelectedDate(dateKeyOf(today)));
  }

  function onFabPress() {
    if (!canManageHolidays) {
      navigation?.navigate('CreateMeeting', { defaultDate: selectedDate });
      return;
    }
    Alert.alert('New', undefined, [
      { text: 'Meeting', onPress: () => navigation?.navigate('CreateMeeting', { defaultDate: selectedDate }) },
      { text: 'Holiday', onPress: () => navigation?.navigate('AddHoliday', { defaultDate: selectedDate }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const rows: typeof grid[] = Array.from({ length: 6 }, (_, i) => grid.slice(i * 7, i * 7 + 7));
  const selectedDayItems = selected ? (itemsByDay[dateKeyOf(selected)] ?? []) : [];
  const selectedMeetings = selectedDayItems.filter((i) => !i.isHoliday);
  const selectedHolidays = selectedDayItems.filter((i) => i.isHoliday);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation?.canGoBack?.() && navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Calendar</Text>
        <TouchableOpacity style={s.todayBtn} onPress={goToday}>
          <Text style={s.todayBtnTx}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* Month / Agenda toggle */}
      <View style={s.toggleRow}>
        <View style={[s.toggleChip, s.toggleChipActive]}>
          <Text style={[s.toggleTx, s.toggleTxActive]}>Month</Text>
        </View>
        <TouchableOpacity style={s.toggleChip} onPress={() => navigation?.navigate('CalendarAgenda')} activeOpacity={0.85}>
          <Text style={s.toggleTx}>Agenda</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={s.card}>
          <View style={s.monthNav}>
            <TouchableOpacity onPress={() => goMonth(-1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={s.monthLabel}>{fmtMonthYear(year, month)}</Text>
            <TouchableOpacity onPress={() => goMonth(1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {loading && !items.length ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={T.primary} />
            </View>
          ) : (
            <>
              <View style={s.dayLabelRow}>
                {DAY_LABELS.map((d, i) => (
                  <View key={i} style={s.dayLabelCell}><Text style={s.dayLabelText}>{d}</Text></View>
                ))}
              </View>

              {rows.map((row, ri) => (
                <View key={ri} style={s.row}>
                  {row.map((cell, ci) => {
                    const key = dateKeyOf(cell.date);
                    const dayItems = itemsByDay[key] ?? [];
                    const isToday = isSameDay(cell.date, today);
                    const isSelected = !!selected && isSameDay(cell.date, selected);
                    const dots = dayItems.slice(0, MAX_DOTS_PER_DAY);
                    const overflow = dayItems.length - dots.length;

                    return (
                      <TouchableOpacity
                        key={ci}
                        style={s.cell}
                        activeOpacity={cell.cur ? 0.7 : 1}
                        onPress={() => cell.cur && dispatch(setSelectedDate(key))}
                      >
                        <View style={[s.circle, isSelected && s.circleSelected, !isSelected && isToday && s.circleToday]}>
                          <Text style={[
                            s.dayNum,
                            !cell.cur && s.dayNumFaded,
                            (isSelected || isToday) && cell.cur && s.dayNumWhite,
                          ]}>
                            {cell.date.getDate()}
                          </Text>
                        </View>
                        <View style={s.dotsRow}>
                          {dots.map((it, di) => (
                            <View key={di} style={[s.eventDot, { backgroundColor: it.isHoliday ? DOT_HOLIDAY : DOT_MEETING }]} />
                          ))}
                          {overflow > 0 && <Text style={s.overflowTx}>+{overflow}</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              <View style={s.legend}>
                <View style={s.legendChip}><View style={[s.legendDot, { backgroundColor: DOT_MEETING }]} /><Text style={s.legendTx}>Meeting</Text></View>
                <View style={s.legendChip}><View style={[s.legendDot, { backgroundColor: DOT_HOLIDAY }]} /><Text style={s.legendTx}>Holiday</Text></View>
              </View>
            </>
          )}
        </View>

        {!!error && !items.length && (
          <View style={s.offline}><Text style={s.offlineTx}>{error}</Text></View>
        )}

        {/* ── Selected day panel ── */}
        <View style={[s.card, { marginTop: 8 }]}>
          <Text style={s.dayPanelTitle}>
            {selected ? selected.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Select a date'}
          </Text>

          {selected && selectedDayItems.length === 0 && (
            <EmptyState
              icon="calendar"
              title="No meetings today"
              subtitle="This day is free — schedule something?"
              cta="Schedule Meeting"
              onPressCta={() => navigation?.navigate('CreateMeeting', { defaultDate: selectedDate })}
            />
          )}

          {selectedHolidays.map((h) => (
            <TouchableOpacity
              key={h.holidayId}
              style={s.holidayRow}
              activeOpacity={0.85}
              onPress={() => h.holidayId && navigation?.navigate('HolidayDetail', {
                holiday: { id: h.holidayId, date: dateKeyOf(new Date(h.startDateTime)), name: h.title, type: h.type, description: h.description },
              })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.holidayName}>{h.title}</Text>
                <Text style={s.holidaySub}>
                  {fmtWeekday(h.startDateTime)}{h.description ? ` · ${h.description}` : ''}
                </Text>
              </View>
              <HolidayTypeBadge type={h.type} />
            </TouchableOpacity>
          ))}

          {selectedMeetings.map((m) => (
            <TouchableOpacity
              key={`${m.eventId}-${m.startDateTime}`}
              style={s.meetingRow}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('MeetingDetail', { eventId: m.eventId })}
            >
              <View style={s.meetingTimeCol}>
                <Text style={s.meetingTime}>{fmtTimeRange(m.startDateTime, m.endDateTime)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.meetingTitle} numberOfLines={1}>{m.title}</Text>
                <Text style={s.meetingMeta}>{m.participantCount} participant{m.participantCount === 1 ? '' : 's'}</Text>
              </View>
              {m.meetingMode && <ModeBadge mode={m.meetingMode} compact />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={s.fab} activeOpacity={0.85} onPress={onFabPress}>
        <Icon name="plus" size={24} color="#FFF" strokeWidth={2.6} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  iconBtn: { width: 28 },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerTitle: { flex: 1, color: '#FFF', fontSize: 17, fontWeight: '700' },
  todayBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  todayBtnTx: { color: '#FFF', fontSize: 12.5, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  toggleChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: T.card },
  toggleChipActive: { backgroundColor: T.primary },
  toggleTx: { fontSize: 13, fontWeight: '700', color: T.sub },
  toggleTxActive: { color: '#FFF' },

  scroll: { flex: 1 },
  card: {
    backgroundColor: T.card, marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 14,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },

  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  navArrow: { fontSize: 26, color: T.ink, fontWeight: '600', paddingHorizontal: 8 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: T.ink },

  dayLabelRow: { flexDirection: 'row', marginBottom: 2 },
  dayLabelCell: { width: CELL, alignItems: 'center', paddingVertical: 4 },
  dayLabelText: { fontSize: 12, color: T.faint, fontWeight: '600' },

  row: { flexDirection: 'row' },
  cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  circleToday: { borderWidth: 1.5, borderColor: T.primary },
  circleSelected: { backgroundColor: T.primary },
  dayNum: { fontSize: 13, fontWeight: '500', color: T.ink },
  dayNumFaded: { color: '#D1D5DB' },
  dayNumWhite: { color: '#FFF', fontWeight: '700' },

  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 3, height: 8, alignItems: 'center' },
  eventDot: { width: 5, height: 5, borderRadius: 2.5 },
  overflowTx: { fontSize: 8, color: T.faint, fontWeight: '800', marginLeft: 1 },

  legend: { flexDirection: 'row', gap: 14, marginTop: 12 },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTx: { fontSize: 11.5, color: T.sub, fontWeight: '500' },

  offline: { marginHorizontal: 16, marginTop: 10, backgroundColor: T.amber.bg, borderRadius: 10, padding: 10 },
  offlineTx: { fontSize: 12, color: T.amber.fg, fontWeight: '600' },

  dayPanelTitle: { fontSize: 14, fontWeight: '800', color: T.ink, marginBottom: 8 },

  holidayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line },
  holidayName: { fontSize: 13.5, fontWeight: '700', color: T.ink },
  holidaySub: { fontSize: 11.5, color: T.sub, marginTop: 2 },

  meetingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line },
  meetingTimeCol: { width: 96 },
  meetingTime: { fontSize: 11.5, color: T.sub, fontWeight: '600' },
  meetingTitle: { fontSize: 14, fontWeight: '700', color: T.ink },
  meetingMeta: { fontSize: 11, color: T.faint, marginTop: 2 },

  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: T.primary, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
});
