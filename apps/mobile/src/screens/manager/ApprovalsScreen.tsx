import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert, LayoutAnimation, Platform, UIManager,
  RefreshControl, Modal, TextInput,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { approve, reject, approveAllPending, fetchApprovals } from '../../store/slices/approvalsSlice';
import { useLivePolling } from '../../utils/useLivePolling';
import {
  T, KIND_META, TINT, ApprovalStatus, initialsOf, avatarColor,
} from '../../data/managerData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Tab = 'pending' | 'approved' | 'rejected';
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function ApprovalsScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector((s: RootState) => s.approvals.items);
  const [tab, setTab] = useState<Tab>('pending');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null); // item id being rejected
  const [rejectReason, setRejectReason] = useState('');

  // Pull real pending leaves + tickets from the DB on focus, then keep
  // polling every 15s while this screen stays open - so a freshly-submitted
  // request shows up while the manager is looking, not only on the next visit.
  useLivePolling(useCallback(() => { dispatch(fetchApprovals()); }, [dispatch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchApprovals());
    setRefreshing(false);
  }, [dispatch]);

  const counts: Record<Tab, number> = {
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
  };
  const visible = items.filter((i) => i.status === (tab as ApprovalStatus));

  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const onApprove = (id: string) => { animate(); dispatch(approve(id)); };
  const onReject = (id: string) => { setRejectReason(''); setRejecting(id); };
  const confirmReject = () => {
    if (!rejecting) return;
    const id = rejecting;
    const reason = rejectReason.trim();
    setRejecting(null);
    animate();
    dispatch(reject({ id, reason: reason || undefined }));
  };
  const onApproveAll = () => {
    if (!counts.pending) return;
    Alert.alert('Approve all', `Approve all ${counts.pending} pending requests?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve all', onPress: () => { animate(); dispatch(approveAllPending()); } },
    ]);
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      {/* ── Header ── */}
      <View style={st.header}>
        <View style={st.headerRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={st.back}>
              <Text style={st.backTx}>‹</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={st.hTitle}>Approvals</Text>
            <Text style={st.hSub}>{counts.pending} awaiting your action</Text>
          </View>
          {tab === 'pending' && counts.pending > 0 && (
            <TouchableOpacity style={st.allBtn} onPress={onApproveAll}>
              <Text style={st.allBtnTx}>Approve all</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* tabs */}
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
            <Text style={st.emptyTx}>{tab === 'pending' ? 'All caught up — no pending approvals' : `No ${tab} requests`}</Text>
          </View>
        )}

        {visible.map((it) => {
          const meta = KIND_META[it.kind];
          const tint = TINT[meta.tint];
          const open = expanded === it.id;
          return (
            <View key={it.id} style={st.card}>
              <TouchableOpacity activeOpacity={0.9} onPress={() => { animate(); setExpanded(open ? null : it.id); }}>
                {/* top row */}
                <View style={st.cardTop}>
                  <View style={[st.kindTag, { backgroundColor: tint.bg }]}>
                    <Text style={{ fontSize: 11 }}>{meta.icon}</Text>
                    <Text style={[st.kindTagTx, { color: tint.fg }]}>{meta.label}</Text>
                  </View>
                  <Text style={st.metaRight}>{it.meta}</Text>
                </View>

                {/* employee + title */}
                <View style={st.who}>
                  <View style={[st.avatar, { backgroundColor: avatarColor(it.employeeName) }]}>
                    <Text style={st.avatarTx}>{initialsOf(it.employeeName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.title}>{it.title}</Text>
                    <Text style={st.subtitle}>{it.employeeName} · {it.subtitle}</Text>
                  </View>
                </View>

                {/* expandable detail */}
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

                <Text style={st.submitted}>Submitted {it.submittedAt}{!open ? '  ·  tap for details' : ''}</Text>
              </TouchableOpacity>

              {/* actions */}
              {it.status === 'pending' ? (
                <View style={st.actions}>
                  <TouchableOpacity style={[st.actBtn, st.rejectBtn]} onPress={() => onReject(it.id)}>
                    <Text style={st.rejectTx}>✕  Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.actBtn, st.approveBtn]} onPress={() => onApprove(it.id)}>
                    <Text style={st.approveTx}>✓  Approve</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[st.resultBar, { backgroundColor: it.status === 'approved' ? T.green.bg : T.red.bg }]}>
                  <Text style={[st.resultTx, { color: it.status === 'approved' ? T.green.fg : T.red.fg }]}>
                    {it.status === 'approved' ? '✓  Approved' : '✕  Rejected'}
                    {it.decidedAt ? `  ·  ${it.decidedAt}` : ''}
                  </Text>
                  {it.status === 'rejected' && !!it.decisionNote && (
                    <Text style={st.resultNote} numberOfLines={2}>“{it.decisionNote}”</Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Reject with reason ── */}
      <Modal visible={!!rejecting} transparent animationType="fade" onRequestClose={() => setRejecting(null)}>
        <View style={st.modalOverlay}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>Reject request</Text>
            <Text style={st.modalSub}>Add an optional reason — the employee will be notified.</Text>
            <TextInput
              style={st.modalInput}
              placeholder="Reason (optional)"
              placeholderTextColor={T.faint}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={st.modalActions}>
              <TouchableOpacity style={[st.modalBtn, st.modalCancel]} onPress={() => setRejecting(null)}>
                <Text style={st.modalCancelTx}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.modalBtn, st.modalReject]} onPress={confirmReject}>
                <Text style={st.modalRejectTx}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 0, paddingHorizontal: 16 },
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
  approveBtn: { backgroundColor: T.primary },
  approveTx: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  resultBar: { marginTop: 12, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  resultTx: { fontWeight: '700', fontSize: 13 },
  resultNote: { marginTop: 4, fontSize: 12, color: '#991B1B', fontStyle: 'italic', textAlign: 'center' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTx: { fontSize: 14, color: T.faint, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: T.card, borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: T.ink },
  modalSub: { fontSize: 12.5, color: T.sub, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  modalInput: { minHeight: 76, borderWidth: 1, borderColor: T.line, borderRadius: 12, padding: 12, fontSize: 14, color: T.ink, textAlignVertical: 'top', backgroundColor: '#F9FAFB' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  modalCancel: { backgroundColor: '#F3F4F6' },
  modalCancelTx: { color: T.ink, fontWeight: '700', fontSize: 14 },
  modalReject: { backgroundColor: '#DC2626' },
  modalRejectTx: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
