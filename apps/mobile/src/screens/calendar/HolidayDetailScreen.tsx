import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { deleteHoliday } from '../../store/slices/calendarSlice';
import { getErrorMessage } from '../../utils/errorMessage';
import Icon from '../../components/Icon';
import { Holiday } from '../../types/calendar';
import { CalendarHeader, HolidayTypeBadge } from './components';
import { T, fmtDateLong } from './calendarTheme';

export default function HolidayDetailScreen({ route, navigation }: any) {
  const holiday: Holiday | undefined = route?.params?.holiday;
  const dispatch = useDispatch<AppDispatch>();
  const role = useSelector((s: RootState) => s.auth.user?.role);
  const canManageHolidays = role === 'hr' || role === 'admin';
  const [busy, setBusy] = useState(false);

  if (!holiday) {
    return (
      <View style={s.root}>
        <CalendarHeader title="Holiday" navigation={navigation} />
        <View style={s.center}><Text style={s.muted}>This holiday could not be loaded.</Text></View>
      </View>
    );
  }

  const isoDateTime = `${holiday.date}T00:00:00`;

  const doDelete = async () => {
    setBusy(true);
    try {
      await dispatch(deleteHoliday(holiday.id)).unwrap();
      navigation?.goBack();
    } catch (e) {
      Alert.alert('Could not delete holiday', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onDeletePress = () => {
    Alert.alert('Delete holiday', `Remove "${holiday.name}" from the calendar?`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <View style={s.root}>
      <CalendarHeader title="Holiday" navigation={navigation} />
      <ScrollView style={s.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <View style={s.topRow}>
            <HolidayTypeBadge type={holiday.type} />
          </View>
          <Text style={s.title}>{holiday.name}</Text>
          {!!holiday.description && <Text style={s.desc}>{holiday.description}</Text>}

          <View style={s.infoRow}>
            <Icon name="calendar" size={15} color={T.sub} />
            <Text style={s.infoTx}>{fmtDateLong(isoDateTime)}</Text>
          </View>
        </View>

        {canManageHolidays && (
          <TouchableOpacity style={s.deleteBtn} onPress={onDeletePress} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#DC2626" size="small" /> : <Text style={s.deleteBtnTx}>Delete holiday</Text>}
          </TouchableOpacity>
        )}
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
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: T.ink, marginTop: 10 },
  desc: { fontSize: 13, color: T.sub, marginTop: 8, lineHeight: 20 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  infoTx: { fontSize: 13, color: T.ink, fontWeight: '600', flex: 1 },

  deleteBtn: {
    marginTop: 18, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', minHeight: 46, justifyContent: 'center',
  },
  deleteBtnTx: { color: '#DC2626', fontSize: 13.5, fontWeight: '700' },
});
