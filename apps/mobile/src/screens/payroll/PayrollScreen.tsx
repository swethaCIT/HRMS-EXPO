import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { payrollApi } from '../../services/api';
import { Payroll } from '../../types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function PayrollScreen() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    payrollApi.getByEmployee('current-employee-id')
      .then(({ data }) => setPayrolls(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payroll</Text>
      <FlatList
        data={payrolls}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardMonth}>{MONTHS[item.month - 1]} {item.year}</Text>
              <View style={[styles.badge, item.status === 'paid' ? styles.badgePaid : styles.badgePending]}>
                <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Net Salary</Text>
              <Text style={styles.rowValue}>₹{Number(item.netSalary).toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Basic</Text>
              <Text style={styles.rowLabel}>₹{Number(item.basicSalary).toLocaleString()}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No payroll records found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardMonth: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgePaid: { backgroundColor: '#d1fae5' },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowLabel: { color: '#6b7280', fontSize: 14 },
  rowValue: { color: '#111827', fontSize: 18, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
});
