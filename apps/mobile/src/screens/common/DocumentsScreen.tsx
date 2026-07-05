import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert, Linking,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { documentApi } from '../../services/api';
import { T } from '../../data/managerData';
import Icon, { IconName } from '../../components/Icon';

/* ── Types ── */
type Category = 'id' | 'contract' | 'payslip' | 'certificate' | 'other';

interface Doc {
  id: string;
  employeeId: string;
  name: string;
  category: Category;
  url: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
}

/* ── Category presentation (icons limited to valid IconName set) ── */
const CATEGORIES: Category[] = ['id', 'contract', 'payslip', 'certificate', 'other'];
const CATEGORY_META: Record<Category, { label: string; icon: IconName; tint: { fg: string; bg: string; solid: string } }> = {
  id:          { label: 'ID Proof',    icon: 'shield',       tint: T.blue },
  contract:    { label: 'Contract',    icon: 'file-text',    tint: T.purple },
  payslip:     { label: 'Payslip',     icon: 'credit-card',  tint: T.green },
  certificate: { label: 'Certificate', icon: 'check-square', tint: T.amber },
  other:       { label: 'Other',       icon: 'box',          tint: { fg: T.sub, bg: '#F3F4F6', solid: T.faint } },
};

/* ── Helpers ── */
function fmtSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtDate(d?: string): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
}
function normCategory(c: any): Category {
  return (CATEGORIES as string[]).includes(c) ? (c as Category) : 'other';
}

export default function DocumentsScreen({ navigation }: any) {
  const employeeId = useSelector((s: RootState) => s.auth.employee?.id);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add-document modal
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fName, setFName] = useState('');
  const [fUrl, setFUrl] = useState('');
  const [fCategory, setFCategory] = useState<Category>('other');

  const load = useCallback(async () => {
    if (!employeeId) { setLoading(false); return; }
    try {
      const { data } = await documentApi.byEmployee(employeeId);
      const mapped: Doc[] = Array.isArray(data)
        ? data.map((d: any) => ({
            id: String(d.id),
            employeeId: d.employeeId,
            name: d.name ?? 'Untitled',
            category: normCategory(d.category),
            url: d.url,
            mimeType: d.mimeType,
            size: d.size,
            createdAt: d.createdAt,
          }))
        : [];
      setDocs(mapped);
    } catch {
      /* leave existing list; surface nothing intrusive */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // Group by category, preserving CATEGORIES order
  const grouped = useMemo(() => {
    return CATEGORIES
      .map((cat) => ({ cat, items: docs.filter((d) => d.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [docs]);

  const openDoc = useCallback((url: string) => {
    if (!url) { Alert.alert('No link', 'This document has no URL to open.'); return; }
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open', 'The document link could not be opened.'));
  }, []);

  const confirmRemove = useCallback((doc: Doc) => {
    Alert.alert('Delete document', `Remove "${doc.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await documentApi.remove(doc.id);
            load();
          } catch {
            Alert.alert('Failed', 'Could not delete the document. Please try again.');
          }
        },
      },
    ]);
  }, [load]);

  const resetForm = () => { setFName(''); setFUrl(''); setFCategory('other'); };

  const submit = useCallback(async () => {
    const name = fName.trim();
    const url = fUrl.trim();
    if (!name) { Alert.alert('Name required', 'Please enter a document name.'); return; }
    if (!url) { Alert.alert('Link required', 'Please enter a URL to the document.'); return; }
    if (!employeeId) { Alert.alert('No employee', 'Cannot add a document without a signed-in employee.'); return; }
    setSubmitting(true);
    try {
      await documentApi.create({ employeeId, name, category: fCategory, url });
      setModalOpen(false);
      resetForm();
      load();
    } catch {
      Alert.alert('Failed', 'Could not save the document. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [fName, fUrl, fCategory, employeeId, load]);

  const total = docs.length;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => navigation?.canGoBack?.() && navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Documents</Text>
        <View style={s.iconBtn} />
      </View>

      {!employeeId ? (
        <View style={s.centerWrap}>
          <View style={s.emptyIcon}><Icon name="file-text" size={30} color={T.faint} /></View>
          <Text style={s.emptyTitle}>Not signed in</Text>
          <Text style={s.emptyText}>Sign in to view and manage your documents.</Text>
        </View>
      ) : loading ? (
        <View style={s.centerWrap}>
          <ActivityIndicator size="large" color={T.primary} />
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        >
          {total === 0 ? (
            <View style={[s.centerWrap, { paddingTop: 40 }]}>
              <View style={s.emptyIcon}><Icon name="file-text" size={30} color={T.faint} /></View>
              <Text style={s.emptyTitle}>No documents yet</Text>
              <Text style={s.emptyText}>Tap “+ Add” to register a document link by name and category.</Text>
            </View>
          ) : (
            grouped.map(({ cat, items }) => {
              const meta = CATEGORY_META[cat];
              return (
                <View key={cat} style={{ marginBottom: 8 }}>
                  <Text style={s.sectionLabel}>{meta.label.toUpperCase()} · {items.length}</Text>
                  {items.map((doc) => (
                    <View key={doc.id} style={s.card}>
                      <View style={s.cardTop}>
                        <View style={[s.iconCircle, { backgroundColor: meta.tint.bg }]}>
                          <Icon name={meta.icon} size={20} color={meta.tint.solid} />
                        </View>
                        <View style={s.cardTitleWrap}>
                          <Text style={s.docName} numberOfLines={2}>{doc.name}</Text>
                          <View style={s.metaRow}>
                            <View style={[s.chip, { backgroundColor: meta.tint.bg }]}>
                              <Text style={[s.chipText, { color: meta.tint.fg }]}>{meta.label}</Text>
                            </View>
                            {!!fmtSize(doc.size) && <Text style={s.metaText}>{fmtSize(doc.size)}</Text>}
                            {!!fmtDate(doc.createdAt) && (
                              <>
                                {!!fmtSize(doc.size) && <Text style={s.metaDot}>·</Text>}
                                <Text style={s.metaText}>{fmtDate(doc.createdAt)}</Text>
                              </>
                            )}
                          </View>
                        </View>
                      </View>

                      <View style={s.divider} />

                      <View style={s.actionsRow}>
                        <TouchableOpacity style={s.openBtn} onPress={() => openDoc(doc.url)}>
                          <Icon name="chevron-right" size={16} color={T.primary} />
                          <Text style={s.openText}>Open</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.deleteBtn}
                          onPress={() => confirmRemove(doc)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={s.deleteGlyph}>🗑</Text>
                          <Text style={s.deleteText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Floating Add button ── */}
      {!!employeeId && (
        <TouchableOpacity style={s.fab} activeOpacity={0.85} onPress={() => setModalOpen(true)}>
          <Text style={s.fabPlus}>＋</Text>
          <Text style={s.fabText}>Add</Text>
        </TouchableOpacity>
      )}

      {/* ── Add document modal ── */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          style={s.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setModalOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Add document</Text>
            <Text style={s.sheetSub}>Register a document by its name, category and a link (URL) to the file.</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>NAME</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Offer Letter 2025"
                placeholderTextColor={T.faint}
                value={fName}
                onChangeText={setFName}
              />

              <Text style={s.fieldLabel}>CATEGORY</Text>
              <View style={s.catRow}>
                {CATEGORIES.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const active = fCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[s.catChip, active && { backgroundColor: meta.tint.bg, borderColor: meta.tint.solid }]}
                      onPress={() => setFCategory(cat)}
                    >
                      <Icon name={meta.icon} size={14} color={active ? meta.tint.solid : T.sub} />
                      <Text style={[s.catChipText, active && { color: meta.tint.fg }]}>{meta.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>LINK (URL)</Text>
              <TextInput
                style={s.input}
                placeholder="https://…"
                placeholderTextColor={T.faint}
                value={fUrl}
                onChangeText={setFUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            </ScrollView>

            <View style={s.sheetActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalOpen(false)} disabled={submitting}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={s.saveText}>Save document</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.header },

  /* header */
  header: {
    backgroundColor: T.header,
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  iconBtn: { width: 32, alignItems: 'flex-start' },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 18, fontWeight: '700' },

  /* scroll sheet */
  scroll: {
    flex: 1,
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: T.faint,
    letterSpacing: 0.8, marginHorizontal: 16, marginBottom: 10, marginTop: 8,
  },

  /* card */
  card: {
    backgroundColor: T.card,
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardTitleWrap: { flex: 1 },
  docName: { fontSize: 15, fontWeight: '700', color: T.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 },
  metaText: { fontSize: 12, color: T.sub },
  metaDot: { fontSize: 12, color: T.faint },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openText: { fontSize: 13, fontWeight: '700', color: T.primary },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  deleteGlyph: { fontSize: 13 },
  deleteText: { fontSize: 13, fontWeight: '600', color: T.red.solid },

  /* empty / center */
  centerWrap: {
    flex: 1, backgroundColor: T.bg,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: T.ink, marginBottom: 6 },
  emptyText: { fontSize: 13, color: T.sub, textAlign: 'center', lineHeight: 19 },

  /* FAB */
  fab: {
    position: 'absolute', right: 20, bottom: 28,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.primary, borderRadius: 28,
    paddingHorizontal: 20, paddingVertical: 14,
    elevation: 6, shadowColor: T.primary, shadowOpacity: 0.4,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  fabPlus: { color: '#FFF', fontSize: 20, fontWeight: '700', marginTop: -2 },
  fabText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  /* modal */
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    maxHeight: '86%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: T.line,
    alignSelf: 'center', marginBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: T.ink },
  sheetSub: { fontSize: 13, color: T.sub, marginTop: 4, marginBottom: 16, lineHeight: 18 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: T.faint, letterSpacing: 0.6, marginBottom: 8, marginTop: 6 },
  input: {
    backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.line,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.ink,
    marginBottom: 6,
  },

  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.line,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  catChipText: { fontSize: 12.5, fontWeight: '600', color: T.sub },

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  cancelBtn: {
    flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: T.sub },
  saveBtn: {
    flex: 2, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.primary,
  },
  saveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
