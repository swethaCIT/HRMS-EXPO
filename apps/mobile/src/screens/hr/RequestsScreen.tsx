import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert, LayoutAnimation, Platform, UIManager,
  RefreshControl,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { issue, rejectRequest, issueAllPending, fetchHRRequests } from '../../store/slices/hrRequestsSlice';
import { useLivePolling } from '../../utils/useLivePolling';
import { initialsOf, avatarColor } from '../../data/managerData';
import { T, HR_KIND_META, TINT, HRRequestStatus } from '../../data/hrData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Tab = 'pending' | 'issued' | 'rejected';
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'issued', label: 'Issued' },
  { key: 'rejected', label: 'Rejected' },
];

export default function RequestsScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector((s: RootState) => s.hrRequests.items);
  const [tab, setTab] = useState<Tab>('pending');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Refetch on focus, then keep polling every 15s while this screen stays
  // open, so a request submitted elsewhere shows up while HR is looking.
  useLivePolling(useCallback(() => { dispatch(fetchHRRequests()); }, [dispatch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchHRRequests());
    setRefreshing(false);
  }, [dispatch]);

  const counts: Record<Tab, number> = {
    pending: items.filter((i) => i.status === 'pending').length,
    issued: items.filter((i) => i.status === 'issued').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
  };
  const visible = items.filter((i) => i.status === (tab as HRRequestStatus));
  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const onIssue = (id: string) => { animate(); dispatch(issue(id)); };
  const onReject = (id: string) =>
    Alert.alert('Reject request', 'Reject this request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => { animate(); dispatch(rejectRequest(id)); } },
    ]);
  const onIssueAll = () => {
    if (!counts.pending) return;
    Alert.alert('Process all', `Process all ${counts.pending} pending requests?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Process all', onPress: () => { animate(); dispatch(issueAllPending()); } },
    ]);
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <View style={st.headerRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={st.back}><Text style={st.backTx}>‹</Text></TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={st.hTitle}>Requests</Text>
            <Text style={st.hSub}>{counts.pending} awaiting your action</Text>
          </View>
          {tab === 'pending' && counts.pending > 0 && (
            <TouchableOpacity style={st.allBtn} onPress={onIssueAll}><Text style={st.allBtnTx}>Process all</Text></TouchableOpacity>
          )}
        </View>
        <View style={st.tabs}>
          {TABS.map((tb) => (
            <TouchableOpacity key={tb.key} style={[st.tab, tab === tb.key && st.tabActive]} onPress={() => { animate(); setTab(tb.key); setExpanded(null); }}>
              <Text style={[st.tabTx, tab === tb.key && st.tabTxActive]}>{tb.label}</Text>
              <View style={[st.tabBadge, tab === tb.key && st.tabBadgeActive]}>
                <Text style={[st.tabBadgeTx, tab === tb.key && st.tabBadgeTxActive]}>{counts[tb.key]}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {visible.length === 0 && (
          <View style={st.empty}>
            <Text style={{ fontSize: 40 }}>{tab === 'pending' ? '🎉' : '📭'}</Text>
            <Text style={st.emptyTx}>{tab === 'pending' ? 'All caught up — no pending requests' : `No ${tab} requests`}</Text>
          </View>
        )}
        {visible.map((it) => {
          const meta = HR_KIND_META[it.kind]; const tint = TINT[meta.tint]; const open = expanded === it.id;
          return (
            <View key={it.id} style={st.card}>
              <TouchableOpacity activeOpacity={0.9} onPress={() => { animate(); setExpanded(open ? null : it.id); }}>
                <View style={st.cardTop}>
                  <View style={[st.kindTag, { backgroundColor: tint.bg }]}>
                    <Text style={{ fontSize: 11 }}>{meta.icon}</Text>
                    <Text style={[st.kindTagTx, { color: tint.fg }]}>{meta.label}</Text>
                  </View>
                  <Text style={st.metaRight}>{it.meta}</Text>
                </View>
                <View style={st.who}>
                  <View style={[st.avatar, { backgroundColor: avatarColor(it.employeeName) }]}>
                    <Text style={st.avatarTx}>{initialsOf(it.employeeName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.title}>{it.title}</Text>
                    <Text style={st.subtitle}>{it.employeeName} · {it.department}</Text>
                  </View>
                </View>
                {open && (
                  <View style={st.detail}>
                    {it.detail.map((d) => (
                      <View key={d.k} style={st.detailRow}>
                        <Text style={st.detailK}>{d.k}</Text>
                        <Text style={st.detailV}>{d.v}</Text>
                      </View>
                    ))}
                    {!!it.reason && (
                      <View style={st.reasonBox}>
                        <Text style={st.reasonLabel}>Reason</Text>
                        <Text style={st.reasonTx}>{it.reason}</Text>
                      </View>
                    )}
                  </View>
                )}
                <Text style={st.submitted}>{it.subtitle} · submitted {it.submittedAt}{!open ? '  ·  tap for details' : ''}</Text>
              </TouchableOpacity>

              {it.status === 'pending' ? (
                <View style={st.actions}>
                  <TouchableOpacity style={[st.actBtn, st.rejectBtn]} onPress={() => onReject(it.id)}><Text style={st.rejectTx}>✕  Reject</Text></TouchableOpacity>
                  <TouchableOpacity style={[st.actBtn, st.issueBtn]} onPress={() => onIssue(it.id)}><Text style={st.issueTx}>✓  {meta.action}</Text></TouchableOpacity>
                </View>
              ) : (
                <View style={[st.resultBar, { backgroundColor: it.status === 'issued' ? T.green.bg : T.red.bg }]}>
                  <Text style={[st.resultTx, { color: it.status === 'issued' ? T.green.fg : T.red.fg }]}>
                    {it.status === 'issued' ? '✓  Processed by you' : '✕  Rejected by you'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 48, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backTx: { color: '#FFF', fontSize: 26, fontWeight: '700', marginTop: -4 },
  hTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  hSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  allBtn: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  allBtnTx: { color: T.primary, fontWeight: '700', fontSize: 12 },
  tabs: { flexDirection: 'row', marginTop: 16, gap: 6 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#FFF' },
  tabTx: { color: 'rgba(255,255,255,0.55)', fontWeight: '600', fontSize: 13 },
  tabTxActive: { color: '#FFF' },
  tabBadge: { minWidth: 20, paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  tabBadgeActive: { backgroundColor: T.primary },
  tabBadgeTx: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '800' },
  tabBadgeTxActive: { color: '#FFF' },

  body: { flex: 1 },
  card: { backgroundColor: T.card, borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  kindTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  kindTagTx: { fontSize: 11, fontWeight: '700' },
  metaRight: { fontSize: 13, fontWeight: '700', color: T.ink },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  title: { fontSize: 15, fontWeight: '700', color: T.ink },
  subtitle: { fontSize: 12, color: T.sub, marginTop: 2 },
  detail: { marginTop: 12, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailK: { fontSize: 12.5, color: T.sub },
  detailV: { fontSize: 12.5, color: T.ink, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  reasonBox: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line },
  reasonLabel: { fontSize: 11, color: T.faint, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  reasonTx: { fontSize: 13, color: T.ink, lineHeight: 19 },
  submitted: { fontSize: 11, color: T.faint, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  rejectTx: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  issueBtn: { backgroundColor: T.primary },
  issueTx: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  resultBar: { marginTop: 12, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  resultTx: { fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTx: { fontSize: 14, color: T.faint, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },
});
