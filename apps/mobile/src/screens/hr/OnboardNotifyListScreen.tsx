import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl, Alert, ActivityIndicator } from 'react-native';
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

const RESENDABLE: OnboardStatus[] = ['invitation_sent', 'link_opened'];

function actionLabel(status: OnboardStatus): string {
  if (RESENDABLE.includes(status)) return 'Resend';
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

  const load = useCallback(async () => {
    try {
      const { data } = await onboardNotifyApi.list();
      setItems(data.items ?? []);
    } catch {
      // Leave the last-known list on screen rather than blanking it on a
      // transient network hiccup.
    } finally {
      setLoading(false);
    }
  }, []);

  useLivePolling(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onResend = (item: OnboardRecord) => {
    Alert.alert('Resend invite', `Resend the onboarding link to ${item.tempName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resend',
        onPress: async () => {
          setResendingId(item.id);
          try {
            await onboardNotifyApi.resend(item.id);
            Alert.alert('Sent', `Onboarding link resent to ${item.tempName}.`);
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
            <Text style={st.hSub}>{items.length} pre-onboarding record{items.length === 1 ? '' : 's'}</Text>
          </View>
          <TouchableOpacity style={st.newBtn} onPress={() => navigation?.navigate('OnboardNotifyCreate')}>
            <Text style={st.newBtnTx}>＋ New</Text>
          </TouchableOpacity>
        </View>
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
            <Text style={st.emptyTx}>No onboarding records yet — tap "＋ New" to invite a candidate.</Text>
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
  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backTx: { color: '#FFF', fontSize: 26, fontWeight: '700', marginTop: -4 },
  hTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  hSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  newBtn: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  newBtnTx: { color: T.primary, fontWeight: '700', fontSize: 13 },

  body: { flex: 1 },
  card: { backgroundColor: T.card, borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  name: { fontSize: 15, fontWeight: '700', color: T.ink },
  sub: { fontSize: 12, color: T.sub, marginTop: 2 },
  statusTag: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  statusTagTx: { fontSize: 11, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.line },
  ref: { fontSize: 11.5, color: T.faint, fontWeight: '600' },
  actionBtn: { backgroundColor: T.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, minWidth: 76, alignItems: 'center' },
  actionBtnTx: { color: '#FFF', fontWeight: '700', fontSize: 12.5 },
  actionBtnGhost: { backgroundColor: '#EEF2FF' },
  actionBtnGhostTx: { color: T.primary },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTx: { fontSize: 14, color: T.faint, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },
});
