import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { cancelMeeting, fetchMeeting, rsvpMeeting } from '../../store/slices/calendarSlice';
import { useLivePolling } from '../../utils/useLivePolling';
import { getErrorMessage } from '../../utils/errorMessage';
import Icon from '../../components/Icon';
import { RsvpStatus } from '../../types/calendar';
import { Avatar, CalendarHeader, EventStatusBadge, ModeBadge, OfflineNote, RsvpBadge } from './components';
import { T, fmtDateLong, fmtTimeRange, RECURRENCE_META } from './calendarTheme';

const RSVP_OPTIONS: { status: RsvpStatus; label: string }[] = [
  { status: 'Accepted', label: 'Accept' },
  { status: 'Tentative', label: 'Tentative' },
  { status: 'Declined', label: 'Decline' },
];

export default function MeetingDetailScreen({ route, navigation }: any) {
  const eventId: string = route?.params?.eventId;
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const employee = useSelector((s: RootState) => s.auth.employee);
  const { meeting, loading, error } = useSelector((s: RootState) => s.calendar.current);

  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { dispatch(fetchMeeting(eventId)); }, [dispatch, eventId]);
  useLivePolling(load, 20_000);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchMeeting(eventId));
    setRefreshing(false);
  }, [dispatch, eventId]);

  if (loading && !meeting) {
    return (
      <View style={s.root}>
        <CalendarHeader title="Meeting" navigation={navigation} />
        <View style={s.center}><ActivityIndicator size="large" color={T.primary} /></View>
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={s.root}>
        <CalendarHeader title="Meeting" navigation={navigation} />
        <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {!!error && <OfflineNote text={error} />}
          <Text style={s.muted}>This meeting could not be loaded. Pull down to retry.</Text>
        </ScrollView>
      </View>
    );
  }

  const isOrganizer = !!user && meeting.createdById === user.id;
  const myParticipant = meeting.participants.find((p) => p.employeeId === employee?.id);
  const isParticipant = !!myParticipant && !isOrganizer;
  const isRecurring = meeting.recurrenceType !== 'NONE';
  const isScheduled = meeting.status === 'SCHEDULED';

  const doCancel = async () => {
    setBusy(true);
    try {
      await dispatch(cancelMeeting(eventId)).unwrap();
      await dispatch(fetchMeeting(eventId));
    } catch (e) {
      Alert.alert('Could not cancel meeting', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onCancelPress = () => {
    if (isRecurring) {
      Alert.alert('Cancel recurring meeting', 'This will apply to the entire series.', [
        { text: 'Keep meeting', style: 'cancel' },
        { text: 'Cancel series', style: 'destructive', onPress: doCancel },
      ]);
    } else {
      Alert.alert('Cancel meeting', 'Are you sure you want to cancel this meeting?', [
        { text: 'Keep meeting', style: 'cancel' },
        { text: 'Cancel meeting', style: 'destructive', onPress: doCancel },
      ]);
    }
  };

  const onEditPress = () => {
    if (isRecurring) {
      Alert.alert('Edit recurring meeting', 'This will apply to the entire series.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => navigation?.navigate('EditMeeting', { eventId }) },
      ]);
    } else {
      navigation?.navigate('EditMeeting', { eventId });
    }
  };

  const onRsvp = async (status: RsvpStatus) => {
    setBusy(true);
    try {
      await dispatch(rsvpMeeting({ id: eventId, status })).unwrap();
    } catch (e) {
      Alert.alert('Could not update RSVP', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openLink = () => {
    if (meeting.meetingLink) Linking.openURL(meeting.meetingLink).catch(() => {});
  };

  return (
    <View style={s.root}>
      <CalendarHeader title="Meeting" navigation={navigation} />
      <ScrollView
        style={s.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {!!error && <OfflineNote text={error} />}

        <View style={s.card}>
          <View style={s.topRow}>
            <EventStatusBadge status={meeting.status} />
            <ModeBadge mode={meeting.meetingMode} />
            {isRecurring && (
              <View style={s.recChip}><Text style={s.recChipTx}>↻ {RECURRENCE_META[meeting.recurrenceType]}</Text></View>
            )}
          </View>
          <Text style={s.title}>{meeting.title}</Text>
          {!!meeting.description && <Text style={s.desc}>{meeting.description}</Text>}

          <View style={s.infoRow}>
            <Icon name="calendar" size={15} color={T.sub} />
            <Text style={s.infoTx}>{fmtDateLong(meeting.startDateTime)}</Text>
          </View>
          <View style={s.infoRow}>
            <Icon name="clock" size={15} color={T.sub} />
            <Text style={s.infoTx}>{fmtTimeRange(meeting.startDateTime, meeting.endDateTime)}</Text>
          </View>
          {!!meeting.location && (
            <View style={s.infoRow}>
              <Icon name="map-pin" size={15} color={T.sub} />
              <Text style={s.infoTx}>{meeting.location}</Text>
            </View>
          )}
          {!!meeting.meetingLink && (
            <TouchableOpacity style={s.infoRow} onPress={openLink} activeOpacity={0.7}>
              <Icon name="link" size={15} color={T.primary} />
              <Text style={[s.infoTx, { color: T.primary }]} numberOfLines={1}>{meeting.meetingLink}</Text>
            </TouchableOpacity>
          )}
          <View style={s.infoRow}>
            <Icon name="user" size={15} color={T.sub} />
            <Text style={s.infoTx}>Organized by {meeting.organizerName || 'Employee'}</Text>
          </View>
        </View>

        {/* ── Organizer actions ── */}
        {isOrganizer && isScheduled && (
          <View style={s.actionRow}>
            <TouchableOpacity style={s.editBtn} onPress={onEditPress} disabled={busy} activeOpacity={0.85}>
              <Text style={s.editBtnTx}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancelPress} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#EF4444" size="small" /> : <Text style={s.cancelBtnTx}>Cancel meeting</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Participant RSVP actions ── */}
        {isParticipant && isScheduled && (
          <View style={s.card}>
            <Text style={s.cardTitle}>YOUR RESPONSE</Text>
            <View style={s.rsvpRow}>
              {RSVP_OPTIONS.map((opt) => {
                const on = myParticipant?.responseStatus === opt.status;
                return (
                  <TouchableOpacity
                    key={opt.status}
                    style={[s.rsvpBtn, on && s.rsvpBtnOn]}
                    onPress={() => onRsvp(opt.status)}
                    disabled={busy}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.rsvpBtnTx, on && s.rsvpBtnTxOn]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Participants ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>PARTICIPANTS · {meeting.participants.length}</Text>
          {meeting.participants.map((p, i) => (
            <View key={p.employeeId} style={[s.participantRow, i < meeting.participants.length - 1 && s.divider]}>
              <Avatar name={p.name} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={s.participantName} numberOfLines={1}>
                  {p.name || 'Employee'}{p.employeeId === meeting.organizerId ? '  ·  Organizer' : ''}
                </Text>
              </View>
              <RsvpBadge status={p.responseStatus} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 13, color: T.sub },

  card: {
    backgroundColor: T.card, borderRadius: 16, padding: 16, marginTop: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  recChip: { backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3.5 },
  recChipTx: { fontSize: 10.5, fontWeight: '800', color: T.primary },
  title: { fontSize: 18, fontWeight: '800', color: T.ink, marginTop: 10 },
  desc: { fontSize: 13, color: T.sub, marginTop: 8, lineHeight: 20 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  infoTx: { fontSize: 13, color: T.ink, fontWeight: '600', flex: 1 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  editBtn: { flex: 1, backgroundColor: T.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  editBtnTx: { color: '#FFF', fontSize: 13.5, fontWeight: '700' },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  cancelBtnTx: { color: '#DC2626', fontSize: 13.5, fontWeight: '700' },

  cardTitle: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.8, marginBottom: 10 },
  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: T.line },
  rsvpBtnOn: { backgroundColor: T.primary, borderColor: T.primary },
  rsvpBtnTx: { fontSize: 12.5, fontWeight: '700', color: T.sub },
  rsvpBtnTxOn: { color: '#FFF' },

  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: T.line },
  participantName: { fontSize: 13.5, fontWeight: '700', color: T.ink },
});
