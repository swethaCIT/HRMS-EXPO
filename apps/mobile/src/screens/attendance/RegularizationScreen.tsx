import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { regularizationApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';

/** Last 7 days (today first) — picking further back is rare enough not to need a full calendar. */
function lastDays(n: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });

/** "09:15" → ISO datetime on the selected date, or null if blank/invalid. */
function timeToIso(date: Date, hhmm: string): string | undefined {
  const m = hhmm.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return undefined;
  const d = new Date(date);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.toISOString();
}

export default function RegularizationScreen({ navigation }: any) {
  const employee = useSelector((s: RootState) => s.auth.employee);
  const days = useMemo(() => lastDays(7), []);
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = reason.trim().length > 0 && (checkIn.trim().length > 0 || checkOut.trim().length > 0);

  async function submit() {
    if (submitting || !canSubmit || !employee?.id) return;
    const requestedCheckIn = checkIn.trim() ? timeToIso(selectedDay, checkIn) : undefined;
    const requestedCheckOut = checkOut.trim() ? timeToIso(selectedDay, checkOut) : undefined;
    if ((checkIn.trim() && !requestedCheckIn) || (checkOut.trim() && !requestedCheckOut)) {
      Alert.alert('Invalid time', 'Enter times as 24-hour HH:MM, e.g. 09:15.');
      return;
    }
    setSubmitting(true);
    try {
      await regularizationApi.create({
        employeeId: employee.id,
        date: dayKey(selectedDay),
        requestedCheckIn,
        requestedCheckOut,
        reason: reason.trim(),
      });
      Alert.alert('Request submitted', 'Your attendance correction has been sent and is awaiting approval.', [
        { text: 'OK', onPress: () => navigation?.goBack?.() },
      ]);
    } catch (e) {
      Alert.alert('Could not submit request', getErrorMessage(e, 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      <View style={s.header}>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => navigation?.goBack?.()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Attendance Correction</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={s.card}>
          <Text style={s.label}>WHICH DAY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {days.map((d) => {
              const active = dayKey(d) === dayKey(selectedDay);
              return (
                <TouchableOpacity
                  key={dayKey(d)}
                  style={[s.dayChip, active && s.dayChipActive]}
                  onPress={() => setSelectedDay(d)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.dayChipText, active && s.dayChipTextActive]}>{dayLabel(d)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={s.label}>REQUESTED CHECK-IN (24H, OPTIONAL)</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. 09:15"
            placeholderTextColor="#9CA3AF"
            value={checkIn}
            onChangeText={setCheckIn}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />

          <Text style={s.label}>REQUESTED CHECK-OUT (24H, OPTIONAL)</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. 18:30"
            placeholderTextColor="#9CA3AF"
            value={checkOut}
            onChangeText={setCheckOut}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />

          <Text style={s.label}>REASON</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="What happened — missed punch, forgot to check out, etc."
            placeholderTextColor="#9CA3AF"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.primaryBtn, (!canSubmit || submitting) && s.primaryBtnOff]}
          onPress={submit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryText}>Submit Request</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    backgroundColor: '#1E1B4B',
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  iconBtn: { width: 36, alignItems: 'flex-start' },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#FFF' },

  scroll: { flex: 1 },
  card: {
    backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 18,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },

  label: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },

  dayChip: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  dayChipActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  dayChipText: { fontSize: 12.5, fontWeight: '600', color: '#6B7280' },
  dayChipTextActive: { color: '#4F46E5' },

  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 14, fontSize: 15, color: '#1F2937', backgroundColor: '#FAFAFA', marginBottom: 8,
  },
  textArea: { minHeight: 110 },

  footer: {
    backgroundColor: '#FFF', padding: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 },
  },
  primaryBtn: { backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnOff: { backgroundColor: '#C4C4DE', opacity: 0.7 },
  primaryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
