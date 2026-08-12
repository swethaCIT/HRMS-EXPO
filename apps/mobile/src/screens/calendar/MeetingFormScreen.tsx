import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import {
  clearCurrentMeeting, clearPicker, createMeeting, fetchMeeting, setSelectedParticipants, updateMeeting,
} from '../../store/slices/calendarSlice';
import { getErrorMessage } from '../../utils/errorMessage';
import Icon from '../../components/Icon';
import { MeetingMode, RecurrenceType } from '../../types/calendar';
import { Avatar, CalendarHeader, DatePickerSheet } from './components';
import {
  T, dateKeyOf, RECURRENCE_META, RECURRENCE_OPTIONS, REMINDER_LABEL,
} from './calendarTheme';

const MODE_OPTIONS: MeetingMode[] = ['Online', 'Offline', 'Hybrid'];
const TITLE_MAX = 100;
const DESC_MAX = 500;

function combineDateTime(date: Date, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}
function fmtHM(h: number, m: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
const TIME_SLOTS: { h: number; m: number }[] = Array.from({ length: 48 }, (_, i) => ({ h: Math.floor(i / 2), m: (i % 2) * 30 }));

/* ── Bottom-sheet time picker (30-min increments) ── */
function TimePickerSheet({ visible, hour, minute, onSelect, onClose }: {
  visible: boolean; hour: number; minute: number; onSelect: (h: number, m: number) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ps.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[ps.sheet, { maxHeight: 420 }]} onPress={(e) => e.stopPropagation()}>
          <View style={ps.handle} />
          <Text style={ps.navLabel}>Select time</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
            {TIME_SLOTS.map((t) => {
              const on = t.h === hour && t.m === minute;
              return (
                <TouchableOpacity key={`${t.h}-${t.m}`} style={ps.timeRow} onPress={() => { onSelect(t.h, t.m); onClose(); }}>
                  <Text style={[ps.timeTx, on && ps.timeTxOn]}>{fmtHM(t.h, t.m)}</Text>
                  {on && <Text style={{ color: T.primary, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function MeetingFormScreen({ route, navigation }: any) {
  const eventId: string | undefined = route?.params?.eventId;
  const isEdit = !!eventId;
  const defaultDateKey: string | undefined = route?.params?.defaultDate;

  const dispatch = useDispatch<AppDispatch>();
  const employee = useSelector((s: RootState) => s.auth.employee);
  const { meeting, loading: loadingMeeting } = useSelector((s: RootState) => s.calendar.current);
  const selectedParticipants = useSelector((s: RootState) => s.calendar.picker.selectedParticipants);

  const initialDate = defaultDateKey ? new Date(`${defaultDateKey}T00:00:00`) : new Date();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(initialDate);
  // Default start = now + 1h, end = now + 2h, both capped at 23:00 so the
  // form never proposes a time past midnight. That cap makes start and end
  // collide at 23:00 whenever the real hour is 22 or 23 — bump the default
  // end minute so start (23:00) still sorts before end (23:30) instead of
  // failing validation before the user has touched anything.
  const defaultStartHour = initialDate.getHours() < 23 ? initialDate.getHours() + 1 : 23;
  const defaultEndHour = initialDate.getHours() < 22 ? initialDate.getHours() + 2 : 23;
  const [startHour, setStartHour] = useState(defaultStartHour);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(defaultEndHour);
  const [endMinute, setEndMinute] = useState(defaultStartHour === defaultEndHour ? 30 : 0);
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('Online');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('NONE');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [startTouched, setStartTouched] = useState(!isEdit);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRecEndPicker, setShowRecEndPicker] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);

  useEffect(() => {
    if (isEdit) dispatch(fetchMeeting(eventId));
    else dispatch(clearPicker());
    return () => { dispatch(clearCurrentMeeting()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Pre-fill the form once the existing meeting loads (edit mode).
  useEffect(() => {
    if (!isEdit || !meeting) return;
    setTitle(meeting.title);
    setDescription(meeting.description ?? '');
    const start = new Date(meeting.startDateTime);
    const end = new Date(meeting.endDateTime);
    setDate(start);
    setStartHour(start.getHours()); setStartMinute(start.getMinutes());
    setEndHour(end.getHours()); setEndMinute(end.getMinutes());
    setMeetingMode(meeting.meetingMode);
    setLocation(meeting.location ?? '');
    setMeetingLink(meeting.meetingLink ?? '');
    setRecurrenceType(meeting.recurrenceType);
    setRecurrenceEndDate(meeting.recurrenceEndDate ? new Date(meeting.recurrenceEndDate) : null);
    dispatch(setSelectedParticipants(
      meeting.participants
        .filter((p) => p.employeeId !== meeting.organizerId)
        .map((p) => ({ employeeId: p.employeeId, name: p.name || 'Employee', avatarUrl: p.avatarUrl, busy: false })),
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, isEdit]);

  const startDateTime = combineDateTime(date, startHour, startMinute);
  const endDateTime = combineDateTime(date, endHour, endMinute);

  function validate(): string | null {
    if (!title.trim()) return 'Title is required.';
    if (title.length > TITLE_MAX) return `Title must be at most ${TITLE_MAX} characters.`;
    if (description.length > DESC_MAX) return `Description must be at most ${DESC_MAX} characters.`;
    if (startDateTime >= endDateTime) return 'Start time must be before end time.';
    if (startTouched && startDateTime.getTime() < Date.now()) return 'Start time cannot be in the past.';
    if (meetingMode === 'Online' && !meetingLink.trim()) return 'A meeting link is required for an online meeting.';
    if (meetingMode === 'Offline' && !location.trim()) return 'A location is required for an offline meeting.';
    if (selectedParticipants.length === 0) return 'Add at least one participant.';
    const ids = selectedParticipants.map((p) => p.employeeId);
    if (new Set(ids).size !== ids.length) return 'Duplicate participants are not allowed.';
    if (ids.length + 1 > 50) return 'A meeting can have at most 50 participants.';
    if (recurrenceType !== 'NONE' && recurrenceEndDate && recurrenceEndDate < startDateTime) return 'Recurrence end date must be on or after the start date.';
    return null;
  }

  async function onSave() {
    const err = validate();
    if (err) { Alert.alert('Check the form', err); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      meetingMode,
      location: location.trim() || undefined,
      meetingLink: meetingLink.trim() || undefined,
      recurrenceType,
      recurrenceEndDate: recurrenceType !== 'NONE' && recurrenceEndDate ? dateKeyOf(recurrenceEndDate) : undefined,
      participantIds: selectedParticipants.map((p) => p.employeeId),
    };
    try {
      if (isEdit) {
        await dispatch(updateMeeting({ id: eventId, payload })).unwrap();
        navigation?.replace('MeetingDetail', { eventId });
      } else {
        const result = await dispatch(createMeeting(payload)).unwrap();
        if (result.conflicts?.length) {
          Alert.alert('Meeting scheduled', 'Saved — but one or more participants already have a meeting at this time.');
        }
        navigation?.replace('MeetingDetail', { eventId: result.eventId });
      }
    } catch (e) {
      Alert.alert(isEdit ? 'Could not update meeting' : 'Could not create meeting', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && loadingMeeting && !meeting) {
    return (
      <View style={s.root}>
        <CalendarHeader title="Edit Meeting" navigation={navigation} />
        <View style={s.center}><ActivityIndicator size="large" color={T.primary} /></View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <CalendarHeader title={isEdit ? 'Edit Meeting' : 'New Meeting'} navigation={navigation} />

      <ScrollView style={s.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={s.label}>TITLE</Text>
        <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. Sprint planning" placeholderTextColor={T.faint} maxLength={TITLE_MAX} />
        <Text style={s.charCount}>{title.length}/{TITLE_MAX}</Text>

        <Text style={s.label}>DESCRIPTION</Text>
        <TextInput
          style={[s.input, { height: 80, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="What's this meeting about?"
          placeholderTextColor={T.faint}
          maxLength={DESC_MAX}
        />
        <Text style={s.charCount}>{description.length}/{DESC_MAX}</Text>

        <Text style={s.label}>DATE</Text>
        <TouchableOpacity style={s.fieldBox} onPress={() => setShowDatePicker(true)}>
          <Text style={s.fieldVal}>{date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          <Icon name="calendar" size={16} color={T.sub} />
        </TouchableOpacity>

        <View style={s.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>START TIME</Text>
            <TouchableOpacity style={s.fieldBox} onPress={() => setShowStartTime(true)}>
              <Text style={s.fieldVal}>{fmtHM(startHour, startMinute)}</Text>
              <Icon name="clock" size={16} color={T.sub} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>END TIME</Text>
            <TouchableOpacity style={s.fieldBox} onPress={() => setShowEndTime(true)}>
              <Text style={s.fieldVal}>{fmtHM(endHour, endMinute)}</Text>
              <Icon name="clock" size={16} color={T.sub} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.label}>MEETING MODE</Text>
        <View style={s.chipWrap}>
          {MODE_OPTIONS.map((mode) => {
            const on = meetingMode === mode;
            return (
              <TouchableOpacity key={mode} style={[s.chip, on && s.chipOn]} onPress={() => setMeetingMode(mode)} activeOpacity={0.85}>
                <Text style={[s.chipTx, on && s.chipTxOn]}>{mode}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {(meetingMode === 'Online' || meetingMode === 'Hybrid') && (
          <>
            <Text style={s.label}>MEETING LINK</Text>
            <TextInput style={s.input} value={meetingLink} onChangeText={setMeetingLink} placeholder="https://meet.example.com/…" placeholderTextColor={T.faint} autoCapitalize="none" />
          </>
        )}
        {(meetingMode === 'Offline' || meetingMode === 'Hybrid') && (
          <>
            <Text style={s.label}>LOCATION</Text>
            <TextInput style={s.input} value={location} onChangeText={setLocation} placeholder="e.g. Conference Room 4B" placeholderTextColor={T.faint} />
          </>
        )}

        <Text style={s.label}>PARTICIPANTS · {selectedParticipants.length} selected</Text>
        <View style={s.participantsCard}>
          <View style={s.participantRow}>
            <Avatar name={`${employee?.firstName ?? ''} ${employee?.lastName ?? ''}`.trim() || 'You'} size={30} />
            <View style={{ flex: 1 }}>
              <Text style={s.participantName}>{`${employee?.firstName ?? ''} ${employee?.lastName ?? ''}`.trim() || 'You'}</Text>
              <Text style={s.participantSub}>Organizer</Text>
            </View>
          </View>
          {selectedParticipants.map((p) => (
            <View key={p.employeeId} style={s.participantRow}>
              <Avatar name={p.name} size={30} />
              <Text style={[s.participantName, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={s.addParticipantsBtn}
          activeOpacity={0.85}
          onPress={() => navigation?.navigate('ParticipantPicker', { startDateTime: startDateTime.toISOString(), endDateTime: endDateTime.toISOString(), excludeEventId: isEdit ? eventId : undefined })}
        >
          <Icon name="plus" size={14} color={T.primary} strokeWidth={2.6} />
          <Text style={s.addParticipantsTx}>Add participants</Text>
        </TouchableOpacity>

        <Text style={s.label}>RECURRENCE</Text>
        <View style={s.chipWrap}>
          {RECURRENCE_OPTIONS.map((rt) => {
            const on = recurrenceType === rt;
            return (
              <TouchableOpacity key={rt} style={[s.chip, on && s.chipOn]} onPress={() => setRecurrenceType(rt)} activeOpacity={0.85}>
                <Text style={[s.chipTx, on && s.chipTxOn]}>{RECURRENCE_META[rt]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {recurrenceType !== 'NONE' && (
          <>
            <Text style={s.label}>ENDS ON (OPTIONAL)</Text>
            <TouchableOpacity style={s.fieldBox} onPress={() => setShowRecEndPicker(true)}>
              <Text style={recurrenceEndDate ? s.fieldVal : s.fieldPlaceholder}>
                {recurrenceEndDate ? recurrenceEndDate.toLocaleDateString('en-GB') : 'No end date · repeats for up to 1 year'}
              </Text>
              <Icon name="calendar" size={16} color={T.sub} />
            </TouchableOpacity>
          </>
        )}

        <Text style={s.label}>REMINDER</Text>
        <View style={[s.fieldBox, { backgroundColor: '#F9FAFB' }]}>
          <Text style={s.fieldVal}>{REMINDER_LABEL}</Text>
          <Icon name="bell" size={16} color={T.faint} />
        </View>

        <TouchableOpacity style={s.submit} onPress={onSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitTx}>{isEdit ? 'Save changes' : 'Schedule meeting'}</Text>}
        </TouchableOpacity>
      </ScrollView>

      <DatePickerSheet visible={showDatePicker} value={date} onSelect={(d) => { setDate(d); setStartTouched(true); }} onClose={() => setShowDatePicker(false)} />
      <DatePickerSheet visible={showRecEndPicker} value={recurrenceEndDate ?? date} onSelect={setRecurrenceEndDate} onClose={() => setShowRecEndPicker(false)} />
      <TimePickerSheet
        visible={showStartTime} hour={startHour} minute={startMinute}
        onSelect={(h, m) => { setStartHour(h); setStartMinute(m); setStartTouched(true); }}
        onClose={() => setShowStartTime(false)}
      />
      <TimePickerSheet
        visible={showEndTime} hour={endHour} minute={endMinute}
        onSelect={(h, m) => { setEndHour(h); setEndMinute(m); }}
        onClose={() => setShowEndTime(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  label: { fontSize: 11, fontWeight: '800', color: T.sub, letterSpacing: 0.8, marginBottom: 8, marginTop: 14 },
  charCount: { fontSize: 10.5, color: T.faint, textAlign: 'right', marginTop: -2 },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: T.ink, backgroundColor: T.card,
  },
  fieldBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, backgroundColor: T.card,
  },
  fieldVal: { fontSize: 14, color: T.ink, fontWeight: '600' },
  fieldPlaceholder: { fontSize: 13, color: T.faint },

  timeRow: { flexDirection: 'row', gap: 12 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: T.primary, borderColor: T.primary },
  chipTx: { fontSize: 12.5, fontWeight: '700', color: T.sub },
  chipTxOn: { color: '#FFF' },

  participantsCard: { backgroundColor: T.card, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: T.line },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line },
  participantName: { fontSize: 13.5, fontWeight: '700', color: T.ink },
  participantSub: { fontSize: 11, color: T.sub, marginTop: 1 },

  addParticipantsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10,
    backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 11,
  },
  addParticipantsTx: { fontSize: 13, fontWeight: '700', color: T.primary },

  submit: { backgroundColor: T.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 26, minHeight: 50 },
  submitTx: { color: '#FFF', fontSize: 14.5, fontWeight: '800' },
});

const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: T.line, alignSelf: 'center', marginBottom: 14 },
  navLabel: { fontSize: 15, fontWeight: '700', color: T.ink },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  timeTx: { fontSize: 14, color: T.ink },
  timeTxOn: { color: T.primary, fontWeight: '700' },
});
