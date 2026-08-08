import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchNotifications, markReadLocal, markAllReadLocal } from '../../store/slices/notificationsSlice';
import { managementKind } from '../../store/slices/authSlice';
import { T } from '../../data/managerData';

const CALENDAR_TYPES = new Set(['calendar_invite', 'calendar_update', 'calendar_cancel', 'calendar_reminder']);

/**
 * Where a notification takes you when tapped, based on type + the user's role.
 * Most types route to a category screen (matching how every list in the app
 * already works — Tickets, Payroll, Leave); calendar_* is the one case with a
 * specific record to jump to, since the notification carries its `eventId`.
 */
function targetRoute(n: { type: string; eventId?: string | null }, kind: 'admin' | 'hr' | 'manager' | null): { route: string; params?: any } | null {
  if (CALENDAR_TYPES.has(n.type)) {
    return n.eventId ? { route: 'MeetingDetail', params: { eventId: n.eventId } } : { route: 'TeamCalendar' };
  }
  if (n.type === 'work_item') return { route: 'MyWorkItems' };

  const type = n.type;
  if (kind === 'manager') {
    if (type === 'leave' || type === 'approval' || type === 'ticket') return { route: 'Approvals' };
    if (type === 'payroll') return { route: 'Payroll' };
    return null;
  }
  if (kind === 'hr') {
    if (type === 'leave' || type === 'approval' || type === 'document') return { route: 'Requests' };
    if (type === 'payroll') return { route: 'Payroll' };
    return null;
  }
  if (kind === 'admin') {
    if (type === 'system' || type === 'approval') return { route: 'Users' };
    return null;
  }
  // employee
  if (type === 'ticket') return { route: 'Tickets' };
  if (type === 'payroll') return { route: 'Payroll' };
  if (type === 'leave') return { route: 'Leave' };
  return null;
}

const TYPE_META: Record<string, { icon: string; bg: string }> = {
  info:              { icon: 'ℹ️', bg: '#EFF6FF' },
  approval:          { icon: '✅', bg: '#ECFDF5' },
  leave:             { icon: '🏖️', bg: '#FEF3C7' },
  payroll:           { icon: '💳', bg: '#EDE9FE' },
  ticket:            { icon: '🎫', bg: '#DBEAFE' },
  system:            { icon: '⚙️', bg: '#F3F4F6' },
  work_item:         { icon: '📋', bg: '#EEF2FF' },
  calendar_invite:   { icon: '🗓️', bg: '#EEF2FF' },
  calendar_update:   { icon: '🗓️', bg: '#EEF2FF' },
  calendar_cancel:   { icon: '🗓️', bg: '#FEE2E2' },
  calendar_reminder: { icon: '⏰', bg: '#FEF3C7' },
};

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (!d || d < 1) return '';
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading } = useSelector((s: RootState) => s.notifications);
  const role = useSelector((s: RootState) => s.auth.user?.role);
  const unread = items.filter((i) => !i.read).length;

  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);

  const onTapNotification = (n: { id: string; type: string; eventId?: string | null }) => {
    dispatch(markReadLocal(n.id));
    const target = targetRoute(n, managementKind(role));
    if (target) { try { navigation?.navigate(target.route, target.params); } catch { /* route not in this stack */ } }
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <View style={st.headerRow}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} style={st.back}><Text style={st.backTx}>‹</Text></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.hTitle}>Notifications</Text>
            <Text style={st.hSub}>{unread > 0 ? `${unread} unread` : 'All caught up'}</Text>
          </View>
          {unread > 0 && (
            <TouchableOpacity style={st.allBtn} onPress={() => dispatch(markAllReadLocal())}><Text style={st.allBtnTx}>Mark all read</Text></TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => dispatch(fetchNotifications())} tintColor={T.primary} />}
      >
        {items.length === 0 && !loading && (
          <View style={st.empty}><Text style={{ fontSize: 40 }}>🔔</Text><Text style={st.emptyTx}>No notifications yet</Text></View>
        )}
        {items.map((n) => {
          const meta = TYPE_META[n.type] ?? TYPE_META.info;
          return (
            <TouchableOpacity
              key={n.id}
              activeOpacity={0.85}
              style={[st.card, !n.read && st.cardUnread]}
              onPress={() => onTapNotification(n)}
            >
              <View style={[st.icon, { backgroundColor: meta.bg }]}><Text style={{ fontSize: 16 }}>{meta.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={st.titleRow}>
                  <Text style={[st.title, !n.read && { fontWeight: '800' }]} numberOfLines={1}>{n.title}</Text>
                  {!n.read && <View style={st.dot} />}
                </View>
                <Text style={st.bodyTx}>{n.body}</Text>
                {!!timeAgo(n.createdAt) && <Text style={st.time}>{timeAgo(n.createdAt)}</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backTx: { color: '#FFF', fontSize: 26, fontWeight: '700', marginTop: -4 },
  hTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  hSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  allBtn: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  allBtnTx: { color: T.primary, fontWeight: '700', fontSize: 12 },

  body: { flex: 1 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: T.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: T.primary },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '600', color: T.ink },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.primary },
  bodyTx: { fontSize: 12.5, color: T.sub, marginTop: 3, lineHeight: 18 },
  time: { fontSize: 11, color: T.faint, marginTop: 6 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTx: { fontSize: 14, color: T.faint, fontWeight: '500' },
});
