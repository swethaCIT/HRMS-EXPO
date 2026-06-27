import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { leaveApi } from '../../services/api';

const LEAVE_TYPES = ['annual', 'sick', 'emergency', 'unpaid'];

export default function LeavesScreen() {
  const [type, setType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const handleApply = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please fill in start and end dates (YYYY-MM-DD)');
      return;
    }
    try {
      await leaveApi.create({
        employeeId: 'current-employee-id',
        type,
        startDate,
        endDate,
        reason,
      });
      Alert.alert('Success', 'Leave application submitted!');
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch {
      Alert.alert('Error', 'Failed to apply for leave');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Apply for Leave</Text>

      <Text style={styles.label}>Leave Type</Text>
      <View style={styles.typeRow}>
        {LEAVE_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, type === t && styles.typeBtnActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2026-07-01" />

      <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="2026-07-03" />

      <Text style={styles.label}>Reason (optional)</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={3}
        placeholder="Reason for leave..."
      />

      <TouchableOpacity style={styles.button} onPress={handleApply}>
        <Text style={styles.buttonText}>Apply Leave</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 24 },
  label: { fontSize: 14, color: '#374151', fontWeight: '500', marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  typeBtnActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  typeBtnText: { color: '#374151', fontSize: 13 },
  typeBtnTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 15 },
  textarea: { height: 80, textAlignVertical: 'top' },
  button: { backgroundColor: '#10b981', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
