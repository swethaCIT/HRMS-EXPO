import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchNotifications } from '../../store/slices/notificationsSlice';
import { attendanceApi, leaveApi, announcementApi, holidayApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import Icon from '../../components/Icon';

const { width } = Dimensions.get('window');

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const TODAY_INDEX = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
const WORK_DAY_MINUTES = 8 * 60;

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;

const fmtHM = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const initialsFromName = (name?: string, max = 2) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, max)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/** Simple ring progress indicator built on react-native-svg (already a dependency via Icon). */
function ProgressRing({
  progress,
  size = 92,
  strokeWidth = 9,
  color = '#4F46E5',
  trackColor = '#E5E7EB',
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = c * (1 - clamped);
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

export default function DashboardScreen({ navigation }: any) {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const employee = useSelector((s: RootState) => s.auth.employee);
  const unread = useSelector((s: RootState) => s.notifications.items.filter((i) => !i.read).length);

  const [today, setToday] = useState<any>(null);
  const [punching, setPunching] = useState(false);
  const [leaveDays, setLeaveDays] = useState<number | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [weekAttendance, setWeekAttendance] = useState<any[]>([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await announcementApi.list();
        if (Array.isArray(data)) {
          const sorted = [...data].sort((a, b) => {
            if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          setAnnouncements(sorted);
        }
      } catch { /* offline */ }
      try {
        const { data } = await holidayApi.list();
        if (Array.isArray(data)) setHolidays(data);
      } catch { /* offline */ }
    })();
  }, []);

  const loadToday = useCallback(async () => {
    if (!employee?.id) return;
    try { const { data } = await attendanceApi.today(employee.id); setToday(data || null); } catch { /* offline */ }
  }, [employee?.id]);

  const loadLeaveBalance = useCallback(async () => {
    if (!employee?.id) return;
    try { const { data } = await leaveApi.balance(employee.id); setLeaveDays(data?.totalRemaining ?? null); } catch { /* offline */ }
  }, [employee?.id]);

  const loadWeekAttendance = useCallback(async () => {
    if (!employee?.id) return;
    try { const { data } = await attendanceApi.getByEmployee(employee.id); if (Array.isArray(data)) setWeekAttendance(data); } catch { /* offline */ }
  }, [employee?.id]);

  // Refetch on focus, then keep polling every 15s while this tab stays open -
  // so a leave approval/rejection from the manager shows up while the
  // employee is looking, not only after they navigate away and back.
  useLivePolling(
    useCallback(() => {
      dispatch(fetchNotifications());
      loadToday();
      loadLeaveBalance();
      loadWeekAttendance();
    }, [dispatch, loadToday, loadLeaveBalance, loadWeekAttendance]),
  );

  const checkedIn = !!today?.checkIn;
  const checkedOut = !!today?.checkOut;

  // Tick every 30s while a punch-in session is live, so the hours ring/counter advances.
  useEffect(() => {
    if (!checkedIn || checkedOut) return;
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [checkedIn, checkedOut]);

  // Distinguishes "server rejected the request" (show its message), "request
  // never got a response" (a real connectivity failure), and everything else
  // (e.g. the app has no API host configured) - a bare catch was showing
  // "Could not reach the server" for all three, hiding the actual cause.
  const describePunchError = (error: any): string => {
    if (error?.response) {
      const msg = error.response.data?.message;
      return Array.isArray(msg) ? msg.join('\n') : msg || `Server error (${error.response.status}).`;
    }
    if (error?.request) return 'Could not reach the server. Check your connection and try again.';
    return error?.message || 'Something went wrong.';
  };

  const punchIn = async (mode: 'office' | 'wfh') => {
    if (!employee?.id) return;
    setPunching(true);
    try { await attendanceApi.checkIn(employee.id, mode); await loadToday(); }
    catch (error) { Alert.alert('Punch failed', describePunchError(error)); }
    finally { setPunching(false); }
  };
  const onPunchIn = () => {
    if (!employee?.id) { Alert.alert('Demo mode', 'Punch needs a real login with an employee profile.'); return; }
    Alert.alert('Punch In', 'Where are you working from today?', [
      { text: 'Office', onPress: () => punchIn('office') },
      { text: 'Work from home', onPress: () => punchIn('wfh') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const onPunchOut = async () => {
    if (!employee?.id) return;
    setPunching(true);
    try { await attendanceApi.checkOut(employee.id); await loadToday(); }
    catch (error) { Alert.alert('Punch failed', describePunchError(error)); }
    finally { setPunching(false); }
  };
  const onMore = () => {
    Alert.alert('More', undefined, [
      { text: 'General request', onPress: () => navigation?.navigate('CreateRequest') },
      { text: 'Regularize attendance', onPress: () => navigation?.navigate('Regularization') },
      { text: 'Documents', onPress: () => navigation?.navigate('Documents') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const initials = employee?.firstName
    ? initialsFromName(`${employee.firstName} ${employee.lastName ?? ''}`)
    : user?.email
      ? (user.email.split('@')[0].substring(0, 2)).toUpperCase()
      : 'JD';

  const subtitleText = [employee?.designation, employee?.department].filter(Boolean).join(' · ');
  const managerInitials = initialsFromName(employee?.reportingManager);
  const modeWord = today?.status === 'wfh' ? 'Remote' : 'Office';
  const headerStatusLabel = checkedIn && !checkedOut
    ? (modeWord === 'Remote' ? 'Working remotely' : 'In office')
    : checkedOut ? 'Day complete' : null;

  const elapsedMinutes = useMemo(() => {
    if (!checkedIn || !today?.checkIn) return 0;
    const start = new Date(today.checkIn).getTime();
    const end = checkedOut && today?.checkOut ? new Date(today.checkOut).getTime() : nowTick;
    return Math.max(0, Math.round((end - start) / 60000));
  }, [checkedIn, checkedOut, today?.checkIn, today?.checkOut, nowTick]);
  const ringProgress = elapsedMinutes / WORK_DAY_MINUTES;

  const attendancePill = !checkedIn
    ? { bg: '#F3F4F6', fg: '#6B7280', dot: '#9CA3AF', label: 'Not checked in' }
    : !checkedOut
      ? { bg: '#D1FAE5', fg: '#065F46', dot: '#10B981', label: `Working · ${modeWord}` }
      : { bg: '#EEF2FF', fg: '#4F46E5', dot: '#4F46E5', label: 'Day complete' };

  // "This week" total = past days from attendance history + today's live session.
  const weeklyMinutes = useMemo(() => {
    const now = new Date();
    const monday = new Date(now); monday.setDate(now.getDate() - TODAY_INDEX); monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
    const todayStr = now.toDateString();
    const historical = weekAttendance.reduce((sum, rec) => {
      const d = new Date(rec.date);
      if (d < monday || d > sunday || d.toDateString() === todayStr) return sum;
      if (!rec.checkIn || !rec.checkOut) return sum;
      return sum + Math.max(0, Math.round((new Date(rec.checkOut).getTime() - new Date(rec.checkIn).getTime()) / 60000));
    }, 0);
    return historical + elapsedMinutes;
  }, [weekAttendance, elapsedMinutes]);

  const holidaysThisMonth = useMemo(() => {
    const now = new Date();
    return holidays.filter((h: any) => {
      const [y, m] = String(h.date).split('-').map(Number);
      return y === now.getFullYear() && (m || 1) - 1 === now.getMonth();
    }).length;
  }, [holidays]);

  const nextHoliday = useMemo(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const future = holidays
      .filter((h: any) => { const [y, m, d] = (h.date || '').split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1).getTime() >= t.getTime(); })
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
    return future[0] || null;
  }, [holidays]);

  const overviewItems = [
    {
      key: 'leave', icon: 'briefcase' as const, label: 'Leave balance',
      value: leaveDays != null ? `${leaveDays} days left` : '—',
      iconBg: '#D1FAE5', iconColor: '#059669', bar: '#10B981',
      onPress: () => navigation?.navigate('ApplyLeave'),
    },
    {
      key: 'attendance', icon: 'check-square' as const, label: 'Attendance',
      value: '94% this month',
      iconBg: '#DBEAFE', iconColor: '#2563EB', bar: '#3B82F6',
      onPress: () => navigation?.navigate('Timesheet'),
    },
    {
      key: 'timesheet', icon: 'hourglass' as const, label: 'Timesheet',
      value: weeklyMinutes > 0 ? `${fmtHM(weeklyMinutes)} logged this week` : 'Nothing logged yet',
      iconBg: '#CCFBF1', iconColor: '#0D9488', bar: '#14B8A6',
      onPress: () => navigation?.navigate('Timesheet'),
    },
    {
      key: 'calendar', icon: 'calendar' as const, label: 'Calendar',
      value: holidaysThisMonth > 0 ? `${holidaysThisMonth} holiday${holidaysThisMonth > 1 ? 's' : ''} this month` : 'No holidays this month',
      iconBg: '#E0E7FF', iconColor: '#4F46E5', bar: '#6366F1',
      onPress: () => navigation?.navigate('Calendar'),
    },
  ];

  const quickActions = [
    { key: 'payslip', icon: 'credit-card' as const, label: 'Payslip', bg: '#DBEAFE', color: '#2563EB', onPress: () => navigation?.navigate('Payroll') },
    { key: 'assets', icon: 'box' as const, label: 'My assets', bg: '#EDE9FE', color: '#7C3AED', onPress: () => navigation?.navigate('Assets') },
    { key: 'leave', icon: 'briefcase' as const, label: 'Leave request', bg: '#D1FAE5', color: '#059669', onPress: () => navigation?.navigate('ApplyLeave') },
    { key: 'calendar', icon: 'calendar' as const, label: 'Calendar', bg: '#E0E7FF', color: '#4F46E5', onPress: () => navigation?.navigate('Calendar') },
    { key: 'goals', icon: 'target' as const, label: 'Goals', bg: '#EDE9FE', color: '#7C3AED', onPress: () => navigation?.navigate('Projects') },
    { key: 'support', icon: 'headphones' as const, label: 'Support tickets', bg: '#FFEDD5', color: '#EA580C', onPress: () => navigation?.navigate('MyTickets') },
    { key: 'more', icon: 'more-horizontal' as const, label: 'More', bg: '#F3F4F6', color: '#4B5563', onPress: onMore },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#162456" />

      {/* ── Header ──
          The gradient is sized in real pixels from onLayout rather than percentage,
          because percentage width/height on react-native-svg doesn't reliably track
          an auto-height parent (the header's height depends on which optional lines
          - subtitle, "reports to" - render), which left the gradient clipped short. */}
      <View style={styles.header} onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
        {headerH > 0 && (
          <Svg style={StyleSheet.absoluteFill} width={width} height={headerH}>
            <Defs>
              <LinearGradient id="hdrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#141E46" stopOpacity="1" />
                <Stop offset="100%" stopColor="#3B5BDB" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={width} height={headerH} fill="url(#hdrGrad)" />
          </Svg>
        )}

        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerGreeting}>
              {getGreeting()}{employee?.firstName ? `, ${employee.firstName}` : ''}
            </Text>
            {!!subtitleText && <Text style={styles.headerSubtitle}>{subtitleText}</Text>}
            {!!employee?.reportingManager && (
              <View style={styles.reportsRow}>
                <View style={styles.reportsAvatar}>
                  <Text style={styles.reportsAvatarTx}>{managerInitials}</Text>
                </View>
                <Text style={styles.reportsText} numberOfLines={1}>
                  Reports to <Text style={styles.reportsName}>{employee.reportingManager}</Text>
                </Text>
                {!!headerStatusLabel && (
                  <View style={styles.reportsStatusWrap}>
                    <Text style={styles.reportsDotSep}>·</Text>
                    <View style={styles.reportsStatusDot} />
                    <Text style={styles.reportsStatus}>{headerStatusLabel}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.bellWrap} onPress={() => navigation?.navigate('Notifications')}>
              <Icon name="bell" size={18} color="#FFFFFF" />
              {unread > 0 && <View style={styles.bellDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={() => navigation?.navigate('Profile')} activeOpacity={0.8}>
              <Text style={styles.avatarText}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.dayIntroTitle}>Today</Text>

        {/* ── Attendance Card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Today's attendance</Text>
            <View style={[styles.statusPill, { backgroundColor: attendancePill.bg }]}>
              <View style={[styles.statusPillDot, { backgroundColor: attendancePill.dot }]} />
              <Text style={[styles.statusPillText, { color: attendancePill.fg }]}>{attendancePill.label}</Text>
            </View>
          </View>

          <View style={styles.attendanceBody}>
            <View style={styles.ringWrap}>
              <ProgressRing progress={ringProgress} />
              <View style={styles.ringCenter} pointerEvents={checkedIn ? 'none' : 'auto'}>
                {checkedIn ? (
                  <>
                    <Text style={styles.ringTimeText}>{fmtHM(elapsedMinutes)}</Text>
                    <Text style={styles.ringOfText}>of 8h</Text>
                  </>
                ) : (
                  <TouchableOpacity onPress={onPunchIn} disabled={punching} activeOpacity={0.8} style={styles.ringPunchBtn}>
                    {punching ? <ActivityIndicator color="#4F46E5" size="small" /> : <Icon name="clock" size={22} color="#4F46E5" />}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.punchList}>
              <View style={styles.punchListRow}>
                <View style={[styles.punchDotOuter, checkedIn && styles.punchDotOuterBlue]}>
                  {checkedIn && <View style={styles.punchDotInnerBlue} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.punchListLabel}>PUNCH IN</Text>
                  <Text style={styles.punchListTime}>{checkedIn ? fmtTime(today.checkIn) : '— : —'}</Text>
                </View>
              </View>

              <View style={styles.punchListRow}>
                <View style={[styles.punchDotOuter, checkedOut && styles.punchDotOuterRed]}>
                  {checkedOut && <View style={styles.punchDotInnerRed} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.punchListLabel}>PUNCH OUT</Text>
                  {checkedOut ? (
                    <Text style={styles.punchListTime}>{fmtTime(today.checkOut)}</Text>
                  ) : checkedIn ? (
                    <TouchableOpacity onPress={onPunchOut} disabled={punching} activeOpacity={0.8}>
                      {punching ? <ActivityIndicator size="small" color="#EF4444" /> : <Text style={styles.punchListAction}>Tap to punch out</Text>}
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.punchListTimeMuted}>Not yet</Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {!checkedIn && (
            <TouchableOpacity style={styles.punchInCta} onPress={onPunchIn} disabled={punching} activeOpacity={0.85}>
              {punching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.punchInCtaTx}>Tap to Punch In</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Work overview ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Work overview</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.overviewGrid}>
            {overviewItems.map((item) => (
              <TouchableOpacity key={item.key} style={styles.overviewCard} activeOpacity={0.8} onPress={item.onPress}>
                <View style={[styles.overviewIconCircle, { backgroundColor: item.iconBg }]}>
                  <Icon name={item.icon} size={18} color={item.iconColor} />
                </View>
                <View style={[styles.overviewBar, { backgroundColor: item.bar }]} />
                <Text style={styles.overviewLabel}>{item.label}</Text>
                <Text style={styles.overviewValue} numberOfLines={2}>{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.quickGrid}>
            {quickActions.map((item) => (
              <TouchableOpacity key={item.key} style={styles.quickItem} activeOpacity={0.75} onPress={item.onPress}>
                <View style={[styles.quickIconCircle, { backgroundColor: item.bg }]}>
                  <Icon name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.quickLabel} numberOfLines={1}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── This Week ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This week</Text>
            <Text style={styles.timelineLink}>Timeline view</Text>
          </View>
          <View style={styles.weekCard}>
            <View style={styles.weekRow}>
              {DAYS.map((day, i) => {
                const isPast = i < TODAY_INDEX;
                const isToday = i === TODAY_INDEX;
                return (
                  <View key={day} style={styles.dayCol}>
                    <Text style={[styles.dayLabel, isToday && styles.dayLabelActive]}>{day}</Text>
                    {isPast ? (
                      <View style={styles.dayCircleDone}>
                        <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : isToday ? (
                      <View style={styles.dayCircleToday}>
                        <View style={styles.dayCircleTodayDot} />
                      </View>
                    ) : (
                      <View style={styles.dayCircleFuture} />
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.todayChipRow}>
              {DAYS.map((day, i) => (
                <View key={day} style={styles.todayChipSlot}>
                  {i === TODAY_INDEX && (
                    <View style={styles.todayChip}><Text style={styles.todayChipTx}>Today</Text></View>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Upcoming Holiday ── */}
        {nextHoliday && (() => {
          const [y, m, d] = String(nextHoliday.date).split('-').map(Number);
          const hd = new Date(y, (m || 1) - 1, d || 1);
          const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
          const daysLeft = Math.round((hd.getTime() - todayMid.getTime()) / 86400000);
          const fullDate = hd.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('Calendar')}
              style={[styles.holidayCard, styles.lastSection]}
            >
              <View style={styles.holidayAccent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.holidayLabel}>UPCOMING HOLIDAY</Text>
                <Text style={styles.holidayName} numberOfLines={1}>{nextHoliday.name}</Text>
                <Text style={styles.holidayDate}>{fullDate}</Text>
              </View>
              <View style={styles.holidayDaysWrap}>
                <Text style={styles.holidayDaysNum}>{daysLeft}</Text>
                <Text style={styles.holidayDaysLabel}>DAYS LEFT</Text>
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* ── Announcements ── */}
        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Announcements')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {announcements.length === 0 ? (
              <Text style={styles.annEmpty}>No announcements right now.</Text>
            ) : (
              announcements.slice(0, 2).map((a, i, arr) => (
                <TouchableOpacity
                  key={a.id}
                  activeOpacity={0.8}
                  onPress={() => navigation?.navigate('Announcements')}
                  style={[styles.annRow, i < arr.length - 1 && styles.annDivider]}
                >
                  <Text style={styles.annPin}>{a.pinned ? '📌' : '📣'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.annTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.annBody} numberOfLines={1}>{a.body}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
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
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerGreeting: {
    fontSize: 21,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
  },
  reportsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
  },
  reportsAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  reportsAvatarTx: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '700' },
  reportsText: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  reportsName: { fontWeight: '700', color: '#FFFFFF' },
  reportsStatusWrap: { flexDirection: 'row', alignItems: 'center' },
  reportsDotSep: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginHorizontal: 4 },
  reportsStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399', marginRight: 4 },
  reportsStatus: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },

  /* Body */
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 24 },

  dayIntroTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },

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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  statusPillDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  /* Attendance body: ring + punch list */
  attendanceBody: { flexDirection: 'row', alignItems: 'center' },
  ringWrap: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringPunchBtn: { alignItems: 'center', justifyContent: 'center' },
  ringTimeText: { fontSize: 15, fontWeight: '800', color: '#1F2937' },
  ringOfText: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },

  punchList: { flex: 1, marginLeft: 24, gap: 18 },
  punchListRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  punchDotOuter: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  punchDotOuterBlue: { borderColor: '#4F46E5' },
  punchDotOuterRed: { borderColor: '#EF4444' },
  punchDotInnerBlue: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4F46E5' },
  punchDotInnerRed: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  punchListLabel: { fontSize: 10.5, color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.6 },
  punchListTime: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 1 },
  punchListTimeMuted: { fontSize: 15, fontWeight: '700', color: '#9CA3AF', marginTop: 1 },
  punchListAction: { fontSize: 13, fontWeight: '700', color: '#4F46E5', marginTop: 2 },

  punchInCta: {
    marginTop: 16, backgroundColor: '#4F46E5', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  punchInCtaTx: { color: '#FFF', fontSize: 14, fontWeight: '700' },

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
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  seeAll: { fontSize: 12.5, color: '#4F46E5', fontWeight: '600' },
  timelineLink: { fontSize: 12.5, color: '#9CA3AF', fontWeight: '600' },

  /* Announcements */
  annRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  annDivider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  annPin: { fontSize: 16 },
  annTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  annBody: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  annEmpty: { fontSize: 13, color: '#9CA3AF', paddingVertical: 8, textAlign: 'center' },

  /* Upcoming Holiday */
  holidayCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFF',
    borderRadius: 16, padding: 14, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  holidayAccent: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: '#10B981' },
  holidayLabel: { fontSize: 10.5, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },
  holidayName: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 3 },
  holidayDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  holidayDaysWrap: { alignItems: 'center' },
  holidayDaysNum: { fontSize: 20, fontWeight: '800', color: '#4F46E5' },
  holidayDaysLabel: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginTop: 1 },

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
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
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
  overviewBar: { width: 22, height: 3, borderRadius: 2, marginBottom: 8 },
  overviewLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  overviewValue: { fontSize: 14, fontWeight: '800', color: '#1F2937' },

  /* Quick Actions */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  quickIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: 11.5, fontWeight: '600', color: '#374151', textAlign: 'center' },

  /* This Week */
  weekCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: { alignItems: 'center', gap: 8, flex: 1 },
  dayLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  dayLabelActive: { color: '#4F46E5', fontWeight: '700' },
  dayCircleDone: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#10B981',
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleToday: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#4F46E5',
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleTodayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4F46E5' },
  dayCircleFuture: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#E5E7EB',
  },
  todayChipRow: { flexDirection: 'row', marginTop: 8 },
  todayChipSlot: { flex: 1, alignItems: 'center' },
  todayChip: { backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  todayChipTx: { fontSize: 9.5, fontWeight: '700', color: '#4F46E5' },
});
