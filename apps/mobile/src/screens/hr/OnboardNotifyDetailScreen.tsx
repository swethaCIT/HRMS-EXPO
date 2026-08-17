import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput, Alert, ActivityIndicator } from 'react-native';
import { T, TINT } from '../../data/hrData';
import { onboardNotifyApi, employeeApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';
import { useLivePolling } from '../../utils/useLivePolling';

const DEPARTMENTS: { key: string; label: string }[] = [
  { key: 'payroll', label: 'Payroll' },
  { key: 'it', label: 'IT' },
  { key: 'admin', label: 'Admin' },
  { key: 'manager', label: 'Manager' },
];

const SECTION_LABELS: Record<string, string> = {
  personalDetails: 'Personal Information',
  contactInfo: 'Contact Information',
  emergencyContact: 'Emergency Contact',
  education: 'Education',
  bankDetails: 'Bank Details',
  employmentHistory: 'Previous Employment',
  documents: 'Documents',
};

const STATUS_META: Record<string, { label: string; tint: keyof typeof TINT }> = {
  invitation_sent: { label: 'Invitation Sent', tint: 'blue' },
  link_opened: { label: 'Link Opened', tint: 'blue' },
  form_in_progress: { label: 'In Progress', tint: 'amber' },
  submitted: { label: 'Submitted', tint: 'purple' },
  hr_review: { label: 'In Review', tint: 'purple' },
  changes_requested: { label: 'Changes Requested', tint: 'red' },
  approved: { label: 'Approved', tint: 'green' },
  forwarded: { label: 'Forwarded', tint: 'green' },
  completed: { label: 'Completed', tint: 'green' },
};

function SectionBlock({ title, data }: { title: string; data: Record<string, any> | null | undefined }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return null;
  return (
    <View style={st.sectionBlock}>
      <Text style={st.sectionTitle}>{title}</Text>
      {entries.map(([k, v]) => (
        <View key={k} style={st.kvRow}>
          <Text style={st.kvKey}>{humanize(k)}</Text>
          <Text style={st.kvVal}>{String(v)}</Text>
        </View>
      ))}
    </View>
  );
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/** Renders {records: [...]}-shaped sections (education, employment history) — repeatable entries, unlike the flat sections SectionBlock handles. */
function RepeatBlock({ title, data }: { title: string; data: { records?: Record<string, any>[] } | null | undefined }) {
  const records = data?.records ?? [];
  if (!records.length) return null;
  return (
    <View style={st.sectionBlock}>
      <Text style={st.sectionTitle}>{title}</Text>
      {records.map((rec, i) => (
        <View key={i} style={i > 0 ? st.repeatDivider : undefined}>
          {Object.entries(rec)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => (
              <View key={k} style={st.kvRow}>
                <Text style={st.kvKey}>{humanize(k)}</Text>
                <Text style={st.kvVal}>{String(v)}</Text>
              </View>
            ))}
        </View>
      ))}
    </View>
  );
}

interface RecipientOption { id: string; userId: string; name: string; designation?: string }

export default function OnboardNotifyDetailScreen({ route, navigation }: any) {
  const id: string = route?.params?.id;
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [fieldCatalog, setFieldCatalog] = useState<{ key: string; label: string }[]>([]);
  const [defaults, setDefaults] = useState<Record<string, string[]>>({});
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState('');
  const [flaggedSections, setFlaggedSections] = useState<Record<string, string>>({});

  const [forwardState, setForwardState] = useState<Record<string, { enabled: boolean; recipient: RecipientOption | null; query: string; pickerOpen: boolean; fields: Set<string> }>>(
    () => Object.fromEntries(DEPARTMENTS.map((d) => [d.key, { enabled: false, recipient: null, query: '', pickerOpen: false, fields: new Set<string>() }])),
  );

  const load = useCallback(async () => {
    try {
      const { data } = await onboardNotifyApi.getOne(id);
      setDetail(data);
    } catch (e: any) {
      Alert.alert('Could not load', getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useLivePolling(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    onboardNotifyApi.fieldCatalog().then(({ data }) => {
      setFieldCatalog(data.fields ?? []);
      setDefaults(data.defaultsByDepartment ?? {});
    }).catch(() => {});
    employeeApi.getAll().then(({ data }) => {
      const list: RecipientOption[] = (data ?? [])
        .filter((e: any) => e.user?.id)
        .map((e: any) => ({ id: e.id, userId: e.user.id, name: `${e.firstName} ${e.lastName}`, designation: e.designation }));
      setRecipients(list);
    }).catch(() => {});
  }, []);

  // Pre-check each department's suggested default fields once the catalog loads.
  useEffect(() => {
    if (!Object.keys(defaults).length) return;
    setForwardState((prev) => {
      const next = { ...prev };
      for (const d of DEPARTMENTS) {
        if (next[d.key].fields.size === 0) next[d.key] = { ...next[d.key], fields: new Set(defaults[d.key] ?? []) };
      }
      return next;
    });
  }, [defaults]);

  const record = detail?.record;
  const response = detail?.response;
  const status: string = record?.status;

  const toggleFlaggedSection = (key: string) => {
    setFlaggedSections((p) => {
      const next = { ...p };
      if (key in next) delete next[key];
      else next[key] = '';
      return next;
    });
  };

  const doReview = async (decision: 'approved' | 'changes_requested') => {
    if (decision === 'changes_requested') {
      if (!comments.trim()) {
        setCommentsOpen(true);
        return Alert.alert('Comments required', 'Add an overall note for the candidate.');
      }
      const picked = Object.entries(flaggedSections);
      if (picked.some(([, reason]) => !reason.trim())) {
        return Alert.alert('Reason required', 'Add a reason for every section you flagged, or unflag it.');
      }
    }
    setBusy(true);
    try {
      const correctionSections =
        decision === 'changes_requested' && Object.keys(flaggedSections).length
          ? Object.entries(flaggedSections).map(([section, reason]) => ({ section, reason: reason.trim() }))
          : undefined;
      await onboardNotifyApi.review(id, decision, decision === 'changes_requested' ? comments.trim() : undefined, correctionSections);
      setComments('');
      setCommentsOpen(false);
      setFlaggedSections({});
      await load();
      Alert.alert(
        decision === 'approved' ? 'Approved' : 'Changes requested',
        decision === 'approved'
          ? 'You can now forward this to departments.'
          : correctionSections
            ? 'The candidate can sign back in to fix the flagged section(s).'
            : 'The candidate can sign back in to update their submission.',
      );
    } catch (e: any) {
      Alert.alert('Action failed', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleDept = (key: string) => {
    setForwardState((p) => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }));
  };
  const toggleField = (deptKey: string, fieldKey: string) => {
    setForwardState((p) => {
      const fields = new Set(p[deptKey].fields);
      if (fields.has(fieldKey)) fields.delete(fieldKey); else fields.add(fieldKey);
      return { ...p, [deptKey]: { ...p[deptKey], fields } };
    });
  };
  const pickRecipient = (deptKey: string, r: RecipientOption) => {
    setForwardState((p) => ({ ...p, [deptKey]: { ...p[deptKey], recipient: r, pickerOpen: false, query: '' } }));
  };

  const selectedDepartments = DEPARTMENTS.filter((d) => forwardState[d.key].enabled);
  const canForward = selectedDepartments.length > 0 && selectedDepartments.every((d) => forwardState[d.key].recipient && forwardState[d.key].fields.size > 0);

  const doForward = async () => {
    setBusy(true);
    try {
      const forwards = selectedDepartments.map((d) => ({
        department: d.key,
        recipientUserId: forwardState[d.key].recipient!.userId,
        fieldsShared: Array.from(forwardState[d.key].fields),
      }));
      await onboardNotifyApi.forward(id, forwards);
      await load();
      Alert.alert('Forwarded', `Shared with ${selectedDepartments.map((d) => d.label).join(', ')}.`);
    } catch (e: any) {
      Alert.alert('Forward failed', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const doComplete = async () => {
    setBusy(true);
    try {
      await onboardNotifyApi.complete(id);
      await load();
    } catch (e: any) {
      Alert.alert('Could not complete', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !record) {
    return (
      <View style={[st.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={T.primary} />
      </View>
    );
  }

  const meta = STATUS_META[status] ?? { label: status, tint: 'blue' as const };
  const tint = TINT[meta.tint];
  const canReview = status === 'submitted' || status === 'hr_review';
  const canForwardStage = status === 'approved';
  const canCompleteStage = status === 'forwarded';

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <View style={st.headerRow}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={st.back}><Text style={st.backTx}>‹</Text></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.hTitle}>{record.tempName}</Text>
            <Text style={st.hSub}>{record.onboardingRef} · {record.employeeType === 'fresher' ? 'Fresher' : 'Experienced'}</Text>
          </View>
          <View style={[st.statusTag, { backgroundColor: tint.bg }]}>
            <Text style={[st.statusTagTx, { color: tint.fg }]}>{meta.label}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={st.card}>
          <Text style={st.sectionTitle}>Overview</Text>
          <View style={st.kvRow}><Text style={st.kvKey}>Mobile</Text><Text style={st.kvVal}>{record.mobile}</Text></View>
          <View style={st.kvRow}><Text style={st.kvKey}>Personal Email</Text><Text style={st.kvVal}>{record.email}</Text></View>
          {!!record.department && <View style={st.kvRow}><Text style={st.kvKey}>Department</Text><Text style={st.kvVal}>{record.department}</Text></View>}
          {!!record.designation && <View style={st.kvRow}><Text style={st.kvKey}>Designation</Text><Text style={st.kvVal}>{record.designation}</Text></View>}
          {!!record.expectedJoiningDate && <View style={st.kvRow}><Text style={st.kvKey}>Expected Joining</Text><Text style={st.kvVal}>{String(record.expectedJoiningDate).slice(0, 10)}</Text></View>}
          {typeof detail.completionPercent === 'number' && (
            <View style={st.progressRow}>
              <View style={st.progressBar}><View style={[st.progressFill, { width: `${detail.completionPercent}%` }]} /></View>
              <Text style={st.progressTx}>{detail.completionPercent}% complete</Text>
            </View>
          )}
        </View>

        {response && (
          <View style={st.card}>
            <SectionBlock title="Personal Information" data={response.personalDetails} />
            <SectionBlock title="Contact Information" data={response.contactInfo} />
            <SectionBlock title="Emergency Contact" data={response.emergencyContact} />
            <RepeatBlock title="Education" data={response.education} />
            <SectionBlock title="Bank Details" data={response.bankDetails} />
            {record.employeeType === 'experienced' && <RepeatBlock title="Previous Employment" data={response.employmentHistory} />}
            {!!(response.documents ?? []).length && (
              <View style={st.sectionBlock}>
                <Text style={st.sectionTitle}>Documents</Text>
                {response.documents.map((d: any, i: number) => (
                  <View key={i} style={st.kvRow}><Text style={st.kvKey}>{humanize(d.category)}</Text><Text style={st.kvVal}>{d.name}</Text></View>
                ))}
              </View>
            )}
          </View>
        )}

        {!!detail.reviews?.length && (
          <View style={st.card}>
            <Text style={st.sectionTitle}>Review History</Text>
            {detail.reviews.map((r: any) => (
              <View key={r.id} style={st.reviewRow}>
                <Text style={st.reviewDecision}>{r.decision === 'approved' ? '✓ Approved' : '↺ Changes Requested'}</Text>
                {!!r.comments && <Text style={st.reviewComment}>{r.comments}</Text>}
                {(r.correctionSections ?? []).map((c: any, i: number) => (
                  <Text key={i} style={st.reviewSection}>• {SECTION_LABELS[c.section] ?? c.section}: {c.reason}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* ── Review actions ── */}
        {canReview && (
          <View style={st.card}>
            <Text style={st.sectionTitle}>Review Decision</Text>
            {commentsOpen && (
              <>
                <TextInput
                  style={st.textarea}
                  placeholder="Overall note for the candidate"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  value={comments}
                  onChangeText={setComments}
                />
                <Text style={[st.label, { marginTop: 2 }]}>Flag specific section(s) — optional, leave none flagged to reopen the whole form</Text>
                <View style={st.fieldGrid}>
                  {Object.keys(detail.sectionsDone ?? {}).map((key) => {
                    const on = key in flaggedSections;
                    return (
                      <TouchableOpacity key={key} style={[st.fieldChip, on && st.fieldChipOn]} onPress={() => toggleFlaggedSection(key)}>
                        <Text style={[st.fieldChipTx, on && st.fieldChipTxOn]}>{SECTION_LABELS[key] ?? key}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {Object.keys(flaggedSections).map((key) => (
                  <View key={key} style={{ marginTop: 10 }}>
                    <Text style={st.label}>Reason — {SECTION_LABELS[key] ?? key}</Text>
                    <TextInput
                      style={st.input}
                      placeholder="What's wrong with this section?"
                      placeholderTextColor="#9CA3AF"
                      value={flaggedSections[key]}
                      onChangeText={(v) => setFlaggedSections((p) => ({ ...p, [key]: v }))}
                    />
                  </View>
                ))}
              </>
            )}
            <View style={[st.row2, { marginTop: commentsOpen ? 14 : 0 }]}>
              <TouchableOpacity style={[st.actBtn, st.rejectBtn]} onPress={() => (commentsOpen ? doReview('changes_requested') : setCommentsOpen(true))} disabled={busy}>
                <Text style={st.rejectTx}>Request Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.actBtn, st.approveBtn]} onPress={() => doReview('approved')} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.approveTx}>Approve</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Forward UI ── */}
        {canForwardStage && (
          <View style={st.card}>
            <Text style={st.sectionTitle}>Forward To Departments</Text>
            <Text style={st.hint}>Nothing is sent automatically — pick departments, recipients and exactly which fields each one sees.</Text>
            {DEPARTMENTS.map((d) => {
              const dState = forwardState[d.key];
              return (
                <View key={d.key} style={st.deptBlock}>
                  <TouchableOpacity style={st.deptHeader} onPress={() => toggleDept(d.key)}>
                    <View style={[st.checkbox, dState.enabled && st.checkboxOn]}>{dState.enabled && <Text style={st.checkboxTick}>✓</Text>}</View>
                    <Text style={st.deptLabel}>{d.label}</Text>
                  </TouchableOpacity>
                  {dState.enabled && (
                    <View style={st.deptBody}>
                      {dState.recipient ? (
                        <View style={st.managerChip}>
                          <Text style={st.managerChipTx}>{dState.recipient.name}</Text>
                          <TouchableOpacity onPress={() => setForwardState((p) => ({ ...p, [d.key]: { ...p[d.key], recipient: null } }))}>
                            <Text style={st.managerChipX}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <TextInput
                            style={st.input}
                            placeholder={`Search ${d.label} recipient…`}
                            placeholderTextColor="#9CA3AF"
                            value={dState.query}
                            onChangeText={(v) => setForwardState((p) => ({ ...p, [d.key]: { ...p[d.key], query: v, pickerOpen: true } }))}
                            onFocus={() => setForwardState((p) => ({ ...p, [d.key]: { ...p[d.key], pickerOpen: true } }))}
                          />
                          {dState.pickerOpen && (
                            <View style={st.managerList}>
                              {recipients
                                .filter((r) => !dState.query.trim() || r.name.toLowerCase().includes(dState.query.trim().toLowerCase()))
                                .slice(0, 15)
                                .map((r) => (
                                  <TouchableOpacity key={r.id} style={st.managerRow} onPress={() => pickRecipient(d.key, r)}>
                                    <Text style={st.managerRowName}>{r.name}</Text>
                                    {!!r.designation && <Text style={st.managerRowDesig}>{r.designation}</Text>}
                                  </TouchableOpacity>
                                ))}
                            </View>
                          )}
                        </>
                      )}

                      <Text style={[st.label, { marginTop: 12 }]}>Fields to share</Text>
                      <View style={st.fieldGrid}>
                        {fieldCatalog.map((f) => {
                          const on = dState.fields.has(f.key);
                          return (
                            <TouchableOpacity key={f.key} style={[st.fieldChip, on && st.fieldChipOn]} onPress={() => toggleField(d.key, f.key)}>
                              <Text style={[st.fieldChipTx, on && st.fieldChipTxOn]}>{f.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
            <TouchableOpacity style={[st.submitBtn, !canForward && st.submitBtnDisabled]} onPress={doForward} disabled={!canForward || busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.submitBtnTx}>Forward Selected</Text>}
            </TouchableOpacity>
          </View>
        )}

        {!!detail.forwards?.length && (
          <View style={st.card}>
            <Text style={st.sectionTitle}>Forwarded To</Text>
            {detail.forwards.map((f: any) => (
              <View key={f.id} style={st.forwardRow}>
                <Text style={st.forwardDept}>{DEPARTMENTS.find((d) => d.key === f.department)?.label ?? f.department}</Text>
                <Text style={st.forwardStatus}>{f.status === 'sent' ? '✓ Delivered' : f.status === 'failed' ? '⚠ Retrying' : '… Pending'}</Text>
              </View>
            ))}
          </View>
        )}

        {canCompleteStage && (
          <TouchableOpacity style={st.submitBtn} onPress={doComplete} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.submitBtnTx}>Mark Onboarding Completed</Text>}
          </TouchableOpacity>
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
  hTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  hSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  statusTag: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  statusTagTx: { fontSize: 11, fontWeight: '700' },

  body: { flex: 1 },
  card: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 14 },
  sectionBlock: { marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: T.ink, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  repeatDivider: { borderTopWidth: 1, borderTopColor: T.line, marginTop: 6, paddingTop: 6 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  kvKey: { fontSize: 12.5, color: T.sub, flex: 1 },
  kvVal: { fontSize: 12.5, color: T.ink, fontWeight: '600', flex: 1, textAlign: 'right' },

  hint: { fontSize: 11.5, color: T.faint, marginBottom: 12, lineHeight: 15 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  progressBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EEF0F3', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: T.primary },
  progressTx: { fontSize: 11.5, fontWeight: '700', color: T.sub },

  reviewRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: T.line },
  reviewDecision: { fontSize: 13, fontWeight: '700', color: T.ink },
  reviewComment: { fontSize: 12.5, color: T.sub, marginTop: 3, lineHeight: 17 },
  reviewSection: { fontSize: 12, color: T.red.fg, marginTop: 3, lineHeight: 16 },

  textarea: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 13, fontSize: 14, color: T.ink, backgroundColor: '#FAFAFA', minHeight: 70, textAlignVertical: 'top', marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 10 },
  actBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  rejectTx: { color: '#DC2626', fontWeight: '700', fontSize: 13.5 },
  approveBtn: { backgroundColor: T.green.solid },
  approveTx: { color: '#FFF', fontWeight: '700', fontSize: 13.5 },

  deptBlock: { borderTopWidth: 1, borderTopColor: T.line, paddingTop: 12, marginTop: 12 },
  deptHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: T.primary, borderColor: T.primary },
  checkboxTick: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  deptLabel: { fontSize: 14, fontWeight: '700', color: T.ink },
  deptBody: { marginTop: 10, marginLeft: 30 },

  label: { fontSize: 12, fontWeight: '700', color: T.sub, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 11, fontSize: 13.5, color: T.ink, backgroundColor: '#FAFAFA' },
  managerChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  managerChipTx: { color: T.primary, fontWeight: '700', fontSize: 13 },
  managerChipX: { color: T.primary, fontWeight: '700', fontSize: 13 },
  managerList: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginTop: 6, maxHeight: 150, overflow: 'hidden' },
  managerRow: { paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  managerRowName: { fontSize: 13, fontWeight: '600', color: T.ink },
  managerRowDesig: { fontSize: 11, color: T.faint, marginTop: 1 },

  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#F3F4F6' },
  fieldChipOn: { backgroundColor: T.primary },
  fieldChipTx: { fontSize: 11.5, fontWeight: '600', color: T.sub },
  fieldChipTxOn: { color: '#FFF' },

  submitBtn: { backgroundColor: T.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 6 },
  submitBtnDisabled: { backgroundColor: '#C7D2FE' },
  submitBtnTx: { color: '#FFF', fontWeight: '700', fontSize: 14.5 },

  forwardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: T.line },
  forwardDept: { fontSize: 13, fontWeight: '600', color: T.ink },
  forwardStatus: { fontSize: 12.5, color: T.sub },
});
