import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { searchParticipants, setPickerWindow, setSearchQuery, toggleParticipant } from '../../store/slices/calendarSlice';
import { useDebouncedValue } from '../../utils/useDebouncedValue';
import Icon from '../../components/Icon';
import { ParticipantSearchResult } from '../../types/calendar';
import { Avatar, CalendarHeader, ConflictBanner } from './components';
import { T } from './calendarTheme';

const PAGE_LIMIT = 20;

export default function ParticipantPickerScreen({ route, navigation }: any) {
  const startDateTime: string | undefined = route?.params?.startDateTime;
  const endDateTime: string | undefined = route?.params?.endDateTime;
  // Set only when editing an existing meeting, so its own participants
  // aren't flagged "Busy" against the very slot they're already booked into.
  const excludeEventId: string | undefined = route?.params?.excludeEventId;

  const dispatch = useDispatch<AppDispatch>();
  const picker = useSelector((s: RootState) => s.calendar.picker);
  const [query, setQuery] = useState(picker.searchQuery);
  const debouncedQuery = useDebouncedValue(query, 350);

  useEffect(() => {
    dispatch(setPickerWindow({ start: startDateTime ?? null, end: endDateTime ?? null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDateTime, endDateTime]);

  useEffect(() => {
    dispatch(setSearchQuery(debouncedQuery));
    dispatch(searchParticipants({ q: debouncedQuery, start: startDateTime, end: endDateTime, page: 1, limit: PAGE_LIMIT, excludeEventId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, startDateTime, endDateTime, excludeEventId]);

  const loadMore = () => {
    if (picker.loading) return;
    if (picker.searchResults.length >= picker.total) return;
    dispatch(searchParticipants({ q: debouncedQuery, start: startDateTime, end: endDateTime, page: picker.page + 1, limit: PAGE_LIMIT, excludeEventId }));
  };

  const selectedIds = new Set(picker.selectedParticipants.map((p) => p.employeeId));
  const busySelected = picker.selectedParticipants.filter((p) => picker.availabilityMap[p.employeeId]);

  const renderItem = ({ item }: { item: ParticipantSearchResult }) => {
    const on = selectedIds.has(item.employeeId);
    return (
      <TouchableOpacity style={s.row} activeOpacity={0.8} onPress={() => dispatch(toggleParticipant(item))}>
        <View style={[s.checkbox, on && s.checkboxOn]}>{on && <Text style={s.checkTx}>✓</Text>}</View>
        <Avatar name={item.name} size={32} />
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          <Text style={s.sub} numberOfLines={1}>{[item.designation, item.department].filter(Boolean).join(' · ') || 'Employee'}</Text>
        </View>
        <View style={[s.availBadge, { backgroundColor: item.busy ? T.red.bg : T.green.bg }]}>
          <View style={[s.availDot, { backgroundColor: item.busy ? T.red.solid : T.green.solid }]} />
          <Text style={[s.availTx, { color: item.busy ? T.red.fg : T.green.fg }]}>{item.busy ? 'Busy' : 'Free'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <CalendarHeader
        title="Add Participants"
        subtitle={`${picker.selectedParticipants.length} selected`}
        navigation={navigation}
        right={
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation?.goBack()} activeOpacity={0.85}>
            <Text style={s.doneBtnTx}>Done</Text>
          </TouchableOpacity>
        }
      />

      <View style={s.searchBar}>
        <Icon name="search" size={16} color={T.faint} />
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, department…"
          placeholderTextColor={T.faint}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="x" size={16} color={T.faint} />
          </TouchableOpacity>
        )}
      </View>

      {busySelected.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <ConflictBanner
            text={`${busySelected.map((p) => p.name).join(', ')} already ${busySelected.length === 1 ? 'has' : 'have'} a meeting at this time.`}
          />
        </View>
      )}

      {picker.selectedParticipants.length > 0 && (
        <View style={s.chipsWrap}>
          {picker.selectedParticipants.map((p) => (
            <TouchableOpacity key={p.employeeId} style={s.chip} onPress={() => dispatch(toggleParticipant(p))} activeOpacity={0.8}>
              <Text style={s.chipTx} numberOfLines={1}>{p.name}</Text>
              <Icon name="x" size={11} color={T.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={picker.searchResults}
        keyExtractor={(item) => item.employeeId}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        ListEmptyComponent={
          picker.loading ? (
            <ActivityIndicator color={T.primary} style={{ marginTop: 30 }} />
          ) : (
            <Text style={s.empty}>No employees found.</Text>
          )
        }
        ListFooterComponent={
          picker.loading && picker.searchResults.length > 0 ? <ActivityIndicator color={T.primary} style={{ marginVertical: 16 }} /> : null
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  doneBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  doneBtnTx: { color: '#FFF', fontSize: 12.5, fontWeight: '700' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: T.line,
  },
  searchInput: { flex: 1, fontSize: 14, color: T.ink, padding: 0 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 6, maxWidth: 160,
  },
  chipTx: { fontSize: 12, fontWeight: '700', color: T.primary },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: T.primary, borderColor: T.primary },
  checkTx: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  name: { fontSize: 13.5, fontWeight: '700', color: T.ink },
  sub: { fontSize: 11, color: T.sub, marginTop: 1 },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3.5 },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availTx: { fontSize: 10.5, fontWeight: '700' },

  empty: { fontSize: 13, color: T.faint, textAlign: 'center', marginTop: 30 },
});
