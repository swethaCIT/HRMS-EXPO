import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { requestApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';
import { HR_KIND_META, HRRequestKind } from '../../data/hrData';
import { TINT } from '../../data/managerData';

/** Kinds an employee can self-submit — 'leave' has its own dedicated flow,
 * 'onboarding' is HR-initiated only, so neither belongs in this picker. */
const SUBMITTABLE_KINDS: HRRequestKind[] = ['document', 'asset', 'profile'];

export default function CreateRequestScreen({ navigation }: any) {
  const [kind, setKind] = useState<HRRequestKind>('document');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && reason.trim().length > 0;

  async function submit() {
    if (submitting || !canSubmit) return;
    setSubmitting(true);
    try {
      await requestApi.create({
        kind,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        reason: reason.trim(),
      });
      Alert.alert('Request submitted', 'Your request has been sent and is awaiting approval.', [
        { text: 'OK', onPress: () => navigation?.goBack?.() },
      ]);
    } catch (e) {
      Alert.alert('Could not submit request', getErrorMessage(e, 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      <View style={s.header}>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => navigation?.goBack?.()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Raise a Request</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={s.card}>
          <Text style={s.label}>REQUEST TYPE</Text>
          <View style={s.kindRow}>
            {SUBMITTABLE_KINDS.map((k) => {
              const meta = HR_KIND_META[k];
              const tint = TINT[meta.tint];
              const active = kind === k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[s.kindCard, active && { borderColor: tint.solid, backgroundColor: tint.bg }]}
                  onPress={() => setKind(k)}
                  activeOpacity={0.8}
                >
                  <Text style={s.kindIcon}>{meta.icon}</Text>
                  <Text style={[s.kindLabel, active && { color: tint.fg }]}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.label}>TITLE</Text>
          <TextInput
            style={s.input}
            placeholder={kind === 'asset' ? 'e.g. New laptop charger' : kind === 'profile' ? 'e.g. Update phone number' : 'e.g. Experience letter'}
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />

          <Text style={s.label}>SUBTITLE (OPTIONAL)</Text>
          <TextInput
            style={s.input}
            placeholder="Short extra context"
            placeholderTextColor="#9CA3AF"
            value={subtitle}
            onChangeText={setSubtitle}
            maxLength={120}
          />

          <Text style={s.label}>REASON</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Explain what you need and why"
            placeholderTextColor="#9CA3AF"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.primaryBtn, (!canSubmit || submitting) && s.primaryBtnOff]}
          onPress={submit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryText}>Submit Request</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    backgroundColor: '#1E1B4B',
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  iconBtn: { width: 36, alignItems: 'flex-start' },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#FFF' },

  scroll: { flex: 1 },
  card: {
    backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 18,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },

  label: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },

  kindRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  kindCard: {
    flex: 1, alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingVertical: 14, backgroundColor: '#FAFAFA',
  },
  kindIcon: { fontSize: 20 },
  kindLabel: { fontSize: 11.5, fontWeight: '700', color: '#374151', textAlign: 'center' },

  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 14, fontSize: 15, color: '#1F2937', backgroundColor: '#FAFAFA', marginBottom: 8,
  },
  textArea: { minHeight: 110 },

  footer: {
    backgroundColor: '#FFF', padding: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 },
  },
  primaryBtn: { backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnOff: { backgroundColor: '#C4C4DE', opacity: 0.7 },
  primaryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
