import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchNotifications } from '../../store/slices/notificationsSlice';

const { width } = Dimensions.get('window');

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const TODAY_INDEX = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatHeaderDate() {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
}

function formatCardDate() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function DashboardScreen({ navigation }: any) {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const unread = useSelector((s: RootState) => s.notifications.items.filter((i) => !i.read).length);
  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);
  const initials = user?.email
    ? (user.email.split('@')[0].substring(0, 2)).toUpperCase()
    : 'JD';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerDate}>{formatHeaderDate()}</Text>
          <Text style={styles.headerGreeting}>{getGreeting()} 👋</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.bellWrap} onPress={() => navigation?.navigate('Notifications')}>
            <Text style={styles.bellEmoji}>🔔</Text>
            {unread > 0 && <View style={styles.bellDot} />}
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Attendance Card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Today's Attendance</Text>
            <Text style={styles.cardDate}>{formatCardDate()}</Text>
          </View>

          <View style={styles.punchRow}>
            {/* Punch In */}
            <View style={styles.punchBox}>
              <View style={styles.punchIconWrap}>
                <Text style={styles.punchEmoji}>🕐</Text>
              </View>
              <Text style={styles.punchLabel}>Punch In</Text>
              <Text style={[styles.punchTime, { color: '#10B981' }]}>09:14 AM</Text>
              <View style={styles.badgeGreen}>
                <Text style={styles.badgeGreenText}>ON TIME</Text>
              </View>
            </View>

            <View style={styles.punchDivider} />

            {/* Punch Out */}
            <View style={styles.punchBox}>
              <View style={styles.punchIconWrap}>
                <Text style={styles.punchEmoji}>📤</Text>
              </View>
              <Text style={styles.punchLabel}>Punch Out</Text>
              <Text style={[styles.punchTime, { color: '#9CA3AF' }]}>{'-- : --'}</Text>
              <View style={styles.badgeOrange}>
                <Text style={styles.badgeOrangeText}>PENDING</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── My Overview ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MY OVERVIEW</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.overviewGrid}>
            {[
              { emoji: '📅', label: 'Leave Balance', value: '12 Days', bg: '#EFF6FF', iconBg: '#DBEAFE' },
              { emoji: '📊', label: 'Attendance',    value: '94%',     bg: '#EFF6FF', iconBg: '#DBEAFE' },
              { emoji: '💻', label: 'My Assets',     value: '03',      bg: '#EFF6FF', iconBg: '#DBEAFE' },
              { emoji: '🎧', label: 'Support',       value: 'Ticket',  bg: '#FFF7ED', iconBg: '#FED7AA' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.overviewCard, { backgroundColor: item.bg }]}
                activeOpacity={0.8}
                onPress={() => item.label === 'My Assets' && navigation?.navigate('Assets')}
              >
                <View style={[styles.overviewIconCircle, { backgroundColor: item.iconBg }]}>
                  <Text style={styles.overviewEmoji}>{item.emoji}</Text>
                </View>
                <Text style={styles.overviewLabel}>{item.label}</Text>
                <Text style={styles.overviewValue}>{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <View style={styles.quickRow}>
            {[
              { emoji: '💳', label: 'Payslip' },
              { emoji: '⏱',  label: 'Timesheet' },
              { emoji: '📦', label: 'Assets' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.quickChip}
                activeOpacity={0.8}
                onPress={() => {
                  if (item.label === 'Assets')    navigation?.navigate('Assets');
                  if (item.label === 'Payslip')   navigation?.navigate('Payroll');
                  if (item.label === 'Timesheet') navigation?.navigate('Timesheet');
                }}
              >
                <Text style={styles.quickEmoji}>{item.emoji}</Text>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── This Week ── */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>THIS WEEK</Text>
          <View style={styles.weekRow}>
            {DAYS.map((day, i) => {
              const isPast    = i < TODAY_INDEX;
              const isToday   = i === TODAY_INDEX;
              const isFuture  = i > TODAY_INDEX;
              return (
                <View key={day} style={styles.dayCol}>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelActive]}>
                    {day}
                  </Text>
                  <View
                    style={[
                      styles.dayDot,
                      isPast   && styles.dotGreen,
                      isToday  && styles.dotBlue,
                      isFuture && styles.dotGray,
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  /* Header */
  header: {
    backgroundColor: '#1E1B4B',
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.8,
    fontWeight: '500',
  },
  headerGreeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellEmoji: { fontSize: 16 },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#1E1B4B',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },

  /* Body */
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 24 },

  /* Card */
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  cardDate:  { fontSize: 12, color: '#6B7280' },

  /* Punch */
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  punchBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  punchDivider: {
    width: 1,
    height: 80,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  punchIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  punchEmoji:  { fontSize: 18 },
  punchLabel:  { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  punchTime:   { fontSize: 20, fontWeight: '700', marginVertical: 2 },
  badgeGreen: {
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeGreenText:  { color: '#065F46', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  badgeOrange: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeOrangeText: { color: '#92400E', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  /* Section */
  section: { marginBottom: 16 },
  lastSection: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  seeAll: { fontSize: 12, color: '#4F46E5', fontWeight: '600' },

  /* Overview Grid */
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewCard: {
    width: (width - 44) / 2,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  overviewIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  overviewEmoji: { fontSize: 18 },
  overviewLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  overviewValue: { fontSize: 20, fontWeight: '800', color: '#1F2937' },

  /* Quick Actions */
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickEmoji: { fontSize: 16 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },

  /* This Week */
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  dayLabelActive: { color: '#4F46E5', fontWeight: '700' },
  dayDot: { width: 10, height: 10, borderRadius: 5 },
  dotGreen:  { backgroundColor: '#10B981' },
  dotBlue:   { backgroundColor: '#4F46E5' },
  dotGray:   { backgroundColor: '#E5E7EB' },
});
