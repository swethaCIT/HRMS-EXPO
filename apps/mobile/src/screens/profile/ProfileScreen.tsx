import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';

export default function ProfileScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() ?? 'U'}</Text>
      </View>
      <Text style={styles.email}>{user?.email}</Text>
      <View style={styles.roleBadge}>
        <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logout())}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', padding: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#1a56db', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  email: { fontSize: 18, color: '#111827', fontWeight: '500', marginBottom: 8 },
  roleBadge: { backgroundColor: '#ede9fe', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 40 },
  roleText: { color: '#5b21b6', fontWeight: '600', fontSize: 12 },
  logoutBtn: { backgroundColor: '#fee2e2', borderRadius: 8, paddingHorizontal: 32, paddingVertical: 14 },
  logoutText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
