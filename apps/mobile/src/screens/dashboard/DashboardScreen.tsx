import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';

const cards = [
  { title: 'Attendance', color: '#3b82f6', desc: 'Check in / Check out' },
  { title: 'Leaves', color: '#10b981', desc: 'Apply & track leaves' },
  { title: 'Payroll', color: '#f59e0b', desc: 'View payslips' },
  { title: 'Profile', color: '#6366f1', desc: 'Manage your profile' },
];

export default function DashboardScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.email?.split('@')[0]} 👋</Text>
        <Text style={styles.role}>{user?.role?.toUpperCase()}</Text>
      </View>

      <View style={styles.grid}>
        {cards.map((card) => (
          <TouchableOpacity key={card.title} style={[styles.card, { backgroundColor: card.color }]}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDesc}>{card.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logout())}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 24 },
  header: { marginBottom: 32 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  role: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 32 },
  card: { width: '47%', borderRadius: 12, padding: 20, minHeight: 100, justifyContent: 'flex-end' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cardDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  logoutBtn: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 16, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontWeight: '600' },
});
