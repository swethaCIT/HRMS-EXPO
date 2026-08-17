import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl, Alert, ActivityIndicator, TextInput } from 'react-native';
import { T, TINT } from '../../data/hrData';
import { avatarColor, initialsOf } from '../../data/managerData';
import { onboardNotifyApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';
import { useLivePolling } from '../../utils/useLivePolling';

type OnboardStatus =
  | 'invitation_sent' | 'link_opened' | 'form_in_progress' | 'submitted' | 'hr_review'
  | 'changes_requested' | 'approved' | 'forwarded' | 'completed';

interface OnboardRecord {
  id: string;
  onboardingRef: string;
  tempName: string;
  employeeType: 'fresher' | 'experienced';
  department?: string;
  designation?: string;
  status: OnboardStatus;
  completionPercent: number;
  createdAt: string;
}

const STATUS_META: Record<OnboardStatus, { label: string; tint: keyof typeof TINT }> = {
  invitation_sent:    { label: 'Invitation Sent',    tint: 'blue' },
  link_opened:        { label: 'Link Opened',        tint: 'blue' },
  form_in_progress:   { label: 'In Progress',        tint: 'amber' },
  submitted:          { label: 'Submitted',          tint: 'purple' },
  hr_review:          { label: 'In Review',          tint: 'purple' },
  changes_requested:  { label: 'Changes Requested',  tint: 'red' },
  approved:           { label: 'Approved',           tint: 'green' },
  forwarded:          { label: 'Forwarded',          tint: 'green' },
  completed:          { label: 'Completed',          tint: 'green' },
};

const STATUS_FILTERS: { key: OnboardStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'invitation_sent', label: 'Invitation Sent' },
  { key: 'form_in_progress', label: 'In Progress' },
  { key: 'hr_review', label: 'Submitted' },
  { key: 'changes_requested', label: 'Changes Requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'completed', label: 'Completed' },
];

const RESENDABLE: OnboardStatus[] = ['invitation_sent', 'link_opened'];

function actionLabel(status: OnboardStatus): string {
  if (RESENDABLE.includes(status)) return 'Send';
  if (status === 'submitted' || status === 'hr_review') return 'Review';
  if (status === 'approved') return 'Forward';
  if (status === 'forwarded') return 'Complete';
  return 'View';
}

export default function OnboardNotifyListScreen({ navigation }: any) {
  const [items, setItems] = useState<OnboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<'all' | 'fresher' | 'experienced'>('all');
  const [statusFilter, setStatusFilter] = useState<OnboardStatus | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await onboardNotifyApi.list({
        employeeType: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        department: deptFilter.trim() || undefined,
      });
      setItems(data.items ?? []);
    } catch {
      // Leave the last-known list on screen rather than blanking it on a
      // transient network hiccup.
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, deptFilter]);

  useLivePolling(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onResend = (item: OnboardRecord) => {
    Alert.alert('Resend invite', `Send a new temporary password to ${item.tempName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resend',
        onPress: async () => {
          setResendingId(item.id);
          try {
            await onboardNotifyApi.resend(item.id);
            Alert.alert('Sent', `A new invitation was sent to ${item.tempName}.`);
          } catch (e: any) {
            Alert.alert('Could not resend', getErrorMessage(e));
          } finally {
            setResendingId(null);
          }
        },
      },
    ]);
  };

  const onAction = (item: OnboardRecord) => {
    if (RESENDABLE.includes(item.status)) return onResend(item);
    navigation?.navigate('OnboardNotifyDetail', { id: item.id });
  };

  const summary = useMemo(() => `${items.length} record${items.length === 1 ? '' : 's'}`, [items.length]);

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <View style={st.headerRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={st.back}><Text style={st.backTx}>‹</Text></TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={st.hTitle}>Onboard Notify</Text>
            <Text style={st.hSub}>{summary}</Text>
          </View>
          <TouchableOpacity style={st.newBtn} onPress={() => navigation?.navigate('OnboardNotifyCreate')}>
            <Text style={st.newBtnTx}>＋ New</Text>
          </TouchableOpacity>
        </View>

        <View style={st.typeRow}>
          {(['all', 'fresher', 'experienced'] as const).map((t) => (
            <TouchableOpacity key={t} style={[st.typeChip, typeFilter === t && st.typeChipActive]} onPress={() => setTypeFilter(t)}>
              <Text style={[st.typeChipTx, typeFilter === t && st.typeChipTxActive]}>{t === 'all' ? 'All Types' : t === 'fresher' ? 'Fresher' : 'Experienced'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.statusScroll} contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map((s) => (
            <TouchableOpacity key={s.key} style={[st.statusChip, statusFilter === s.key && st.statusChipActive]} onPress={() => setStatusFilter(s.key)}>
              <Text style={[st.statusChipTx, statusFilter === s.key && st.statusChipTxActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput
          style={st.deptInput}
          placeholder="Filter by department…"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={deptFilter}
          onChangeText={setDeptFilter}
        />
      </View>

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={T.primary} />
        ) : items.length === 0 ? (
          <View style={st.empty}>
            <Text style={{ fontSize: 40 }}>🧾</Text>
            <Text style={st.emptyTx}>No onboarding records match — tap "＋ New" to invite a candidate.</Text>
          </View>
        ) : (
          items.map((item) => {
            const meta = STATUS_META[item.status];
            const tint = TINT[meta.tint];
            const busy = resendingId === item.id;
            return (
              <TouchableOpacity key={item.id} style={st.card} activeOpacity={0.85} onPress={() => navigation?.navigate('OnboardNotifyDetail', { id: item.id })}>
                <View style={st.cardTop}>
                  <View style={[st.avatar, { backgroundColor: avatarColor(item.tempName) }]}>
                    <Text style={st.avatarTx}>{initialsOf(item.tempName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{item.tempName}</Text>
                    <Text style={st.sub}>
                      {item.employeeType === 'fresher' ? 'Fresher' : 'Experienced'}
                      {item.department ? ` · ${item.department}` : ''}
                    </Text>
                  </View>
                  <View style={[st.statusTag, { backgroundColor: tint.bg }]}>
                    <Text style={[st.statusTagTx, { color: tint.fg }]}>{meta.label}</Text>
                  </View>
                </View>

                <View style={st.progressRow}>
                  <View style={st.progressBar}><View style={[st.progressFill, { width: `${item.completionPercent}%`, backgroundColor: tint.solid }]} /></View>
                  <Text style={st.progressTx}>{item.completionPercent}%</Text>
                </View>

                <View style={st.cardBottom}>
                  <Text style={st.ref}>{item.onboardingRef}</Text>
                  <TouchableOpacity
                    style={[st.actionBtn, RESENDABLE.includes(item.status) && st.actionBtnGhost]}
                    onPress={() => onAction(item)}
                    disabled={busy}
                  >
                    {busy ? <ActivityIndicator size="small" color={T.primary} /> : (
                      <Text style={[st.actionBtnTx, RESENDABLE.includes(item.status) && st.actionBtnGhostTx]}>{actionLabel(item.status)}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backTx: { color: '#FFF', fontSize: 26, fontWeight: '700', marginTop: -4 },
  hTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  hSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  newBtn: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  newBtnTx: { color: T.primary, fontWeight: '700', fontSize: 13 },

  typeRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  typeChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  typeChipActive: { backgroundColor: '#FFF' },
  typeChipTx: { fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  typeChipTxActive: { color: T.primary },

  statusScroll: { marginTop: 10 },
  statusChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)' },
  statusChipActive: { backgroundColor: T.primary },
  statusChipTx: { fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  statusChipTxActive: { color: '#FFF' },

  deptInput: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, color: '#FFF', fontSize: 13 },

  body: { flex: 1 },
  card: { backgroundColor: T.card, borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  name: { fontSize: 15, fontWeight: '700', color: T.ink },
  sub: { fontSize: 12, color: T.sub, marginTop: 2 },
  statusTag: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  statusTagTx: { fontSize: 11, fontWeight: '700' },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  progressBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EEF0F3', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressTx: { fontSize: 11, fontWeight: '700', color: T.sub, width: 32, textAlign: 'right' },

  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.line },
  ref: { fontSize: 11.5, color: T.faint, fontWeight: '600' },
  actionBtn: { backgroundColor: T.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, minWidth: 76, alignItems: 'center' },
  actionBtnTx: { color: '#FFF', fontWeight: '700', fontSize: 12.5 },
  actionBtnGhost: { backgroundColor: '#EEF2FF' },
  actionBtnGhostTx: { color: T.primary },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTx: { fontSize: 14, color: T.faint, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },
});
