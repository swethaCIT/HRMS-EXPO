import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { attendanceApi } from '../../services/api';

export default function AttendanceScreen() {
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      await attendanceApi.checkIn('current-employee-id');
      setCheckedIn(true);
      Alert.alert('Success', 'Checked in successfully!');
    } catch {
      Alert.alert('Error', 'Failed to check in');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      await attendanceApi.checkOut('current-employee-id');
      setCheckedIn(false);
      Alert.alert('Success', 'Checked out successfully!');
    } catch {
      Alert.alert('Error', 'Failed to check out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance</Text>
      <Text style={styles.date}>{new Date().toDateString()}</Text>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>{checkedIn ? 'CHECKED IN' : 'NOT CHECKED IN'}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 32 }} />
      ) : (
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btn, checkedIn && styles.btnDisabled]}
            onPress={handleCheckIn}
            disabled={checkedIn}
          >
            <Text style={styles.btnText}>Check In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnOut, !checkedIn && styles.btnDisabled]}
            onPress={handleCheckOut}
            disabled={!checkedIn}
          >
            <Text style={styles.btnText}>Check Out</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  date: { fontSize: 16, color: '#6b7280', marginBottom: 32 },
  statusBadge: { backgroundColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 32 },
  statusText: { color: '#1d4ed8', fontWeight: '600' },
  buttons: { gap: 16, width: '100%' },
  btn: { backgroundColor: '#1a56db', borderRadius: 12, padding: 18, alignItems: 'center' },
  btnOut: { backgroundColor: '#ef4444' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
