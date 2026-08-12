import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { createHoliday } from '../../store/slices/calendarSlice';
import { getErrorMessage } from '../../utils/errorMessage';
import Icon from '../../components/Icon';
import { HolidayType } from '../../types/calendar';
import { CalendarHeader, DatePickerSheet } from './components';
import { T, dateKeyOf, HOLIDAY_TYPE_META, HOLIDAY_TYPE_OPTIONS } from './calendarTheme';

export default function AddHolidayScreen({ route, navigation }: any) {
  const defaultDateKey: string | undefined = route?.params?.defaultDate;
  const dispatch = useDispatch<AppDispatch>();

  const [date, setDate] = useState(defaultDateKey ? new Date(`${defaultDateKey}T00:00:00`) : new Date());
  const [name, setName] = useState('');
  const [type, setType] = useState<HolidayType>('public');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  async function onSave() {
    if (!name.trim()) { Alert.alert('Check the form', 'Give the holiday a name.'); return; }
    setSaving(true);
    try {
      const holiday = await dispatch(createHoliday({
        date: dateKeyOf(date),
        name: name.trim(),
        type,
        description: description.trim() || undefined,
      })).unwrap();
      navigation?.replace('HolidayDetail', { holiday });
    } catch (e) {
      Alert.alert('Could not create holiday', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.root}>
      <CalendarHeader title="Add Holiday" navigation={navigation} />

      <ScrollView style={s.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={s.label}>DATE</Text>
        <TouchableOpacity style={s.fieldBox} onPress={() => setShowDatePicker(true)}>
          <Text style={s.fieldVal}>{date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          <Icon name="calendar" size={16} color={T.sub} />
        </TouchableOpacity>

        <Text style={s.label}>NAME</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Independence Day" placeholderTextColor={T.faint} />

        <Text style={s.label}>TYPE</Text>
        <View style={s.chipWrap}>
          {HOLIDAY_TYPE_OPTIONS.map((opt) => {
            const on = type === opt;
            const meta = HOLIDAY_TYPE_META[opt];
            return (
              <TouchableOpacity key={opt} style={[s.chip, on && { backgroundColor: meta.solid, borderColor: meta.solid }]} onPress={() => setType(opt)} activeOpacity={0.85}>
                <Text style={[s.chipTx, on && s.chipTxOn]}>{meta.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.label}>DESCRIPTION (OPTIONAL)</Text>
        <TextInput
          style={[s.input, { height: 80, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Any extra detail worth showing on the calendar…"
          placeholderTextColor={T.faint}
        />

        <TouchableOpacity style={s.submit} onPress={onSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitTx}>Add holiday</Text>}
        </TouchableOpacity>
      </ScrollView>

      <DatePickerSheet visible={showDatePicker} value={date} onSelect={setDate} onClose={() => setShowDatePicker(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },

  label: { fontSize: 11, fontWeight: '800', color: T.sub, letterSpacing: 0.8, marginBottom: 8, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: T.ink, backgroundColor: T.card,
  },
  fieldBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, backgroundColor: T.card,
  },
  fieldVal: { fontSize: 14, color: T.ink, fontWeight: '600' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  chipTx: { fontSize: 12.5, fontWeight: '700', color: T.sub },
  chipTxOn: { color: '#FFF' },

  submit: { backgroundColor: T.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 26, minHeight: 50 },
  submitTx: { color: '#FFF', fontSize: 14.5, fontWeight: '800' },
});
