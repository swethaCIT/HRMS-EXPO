import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Modal,
} from 'react-native';
import {
  DEPARTMENTS, PRIORITIES, WORK_MODES, DIRECTORY,
  Priority, WorkMode, Person, TicketDepartment, TicketCategory,
} from '../../data/ticketTaxonomy';

type Step = 1 | 2 | 3;
const STEP_TITLES: Record<Step, string> = { 1: 'Basic Details', 2: 'Describe', 3: 'Review' };

export default function RaiseTicketScreen({ navigation, route }: any) {
  const [step, setStep] = useState<Step>(1);

  /* form state */
  const [dept, setDept]             = useState<TicketDepartment | null>(null);
  const [category, setCategory]     = useState<TicketCategory | null>(null);
  const [subCategory, setSubCat]    = useState<string | null>(null);
  const [workMode, setWorkMode]     = useState<WorkMode>('Office');
  const [priority, setPriority]     = useState<Priority>('Medium');
  const [notify, setNotify]         = useState<Person[]>([DIRECTORY[0], DIRECTORY[1]]);
  const [subject, setSubject]       = useState('');
  const [description, setDesc]      = useState('');
  const [attachments, setAttach]    = useState<string[]>([]);

  /* pickers */
  const [picker, setPicker] = useState<null | 'category' | 'subcategory' | 'notify'>(null);

  const canNext1 = !!dept && !!category && !!subCategory;
  const canNext2 = subject.trim().length > 0 && description.trim().length > 0;

  /* selecting a new department resets the cascade */
  function chooseDept(d: TicketDepartment) {
    setDept(d);
    setCategory(null);
    setSubCat(null);
  }
  function chooseCategory(c: TicketCategory) {
    setCategory(c);
    setSubCat(null);
    setPicker(null);
  }

  function toggleNotify(p: Person) {
    setNotify(prev =>
      prev.find(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : [...prev, p],
    );
  }

  function submit() {
    const ticket = {
      dept: dept?.label, category: category?.label, subCategory,
      workMode, priority, subject, description,
      notify: notify.map(n => n.name), attachments,
    };
    // hand the new ticket back to the Tickets tab list
    navigation?.navigate?.('Tickets', { newTicket: ticket });
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => (step === 1 ? navigation?.goBack() : setStep((step - 1) as Step))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Raise a Ticket</Text>
          <Text style={s.headerStep}>Step {step} of 3: {STEP_TITLES[step]}</Text>
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={s.progressWrap}>
        {[1, 2, 3].map(n => (
          <View key={n} style={[s.progressSeg, n <= step && s.progressSegActive]} />
        ))}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={s.card}>

          {/* ═══════ STEP 1 — Basic Details ═══════ */}
          {step === 1 && (
            <>
              <Text style={s.label}>SELECT DEPARTMENT</Text>
              <View style={s.deptGrid}>
                {DEPARTMENTS.map(d => {
                  const active = dept?.key === d.key;
                  return (
                    <TouchableOpacity
                      key={d.key}
                      style={[s.deptCard, active && s.deptCardActive]}
                      onPress={() => chooseDept(d)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.deptIcon}>{d.icon}</Text>
                      <Text style={[s.deptLabel, active && s.deptLabelActive]}>{d.label}</Text>
                      {active && <Text style={s.deptCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Category */}
              <Text style={s.label}>CATEGORY</Text>
              <TouchableOpacity
                style={[s.dropdown, !dept && s.dropdownDisabled]}
                onPress={() => dept && setPicker('category')}
                activeOpacity={dept ? 0.7 : 1}
              >
                <Text style={category ? s.dropdownVal : s.dropdownPlaceholder}>
                  {category?.label ?? (dept ? 'Select category' : 'Select a department first')}
                </Text>
                <Text style={s.dropdownArrow}>▾</Text>
              </TouchableOpacity>

              {/* Sub Category */}
              <Text style={s.label}>SUB CATEGORY</Text>
              <TouchableOpacity
                style={[s.dropdown, !category && s.dropdownDisabled]}
                onPress={() => category && setPicker('subcategory')}
                activeOpacity={category ? 0.7 : 1}
              >
                <Text style={subCategory ? s.dropdownVal : s.dropdownPlaceholder}>
                  {subCategory ?? (category ? 'Select sub category' : 'Select a category first')}
                </Text>
                <Text style={s.dropdownArrow}>▾</Text>
              </TouchableOpacity>

              {/* Work Mode */}
              <Text style={s.label}>WORK MODE</Text>
              <View style={s.pillRow}>
                {WORK_MODES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.pill, workMode === m && s.pillActive]}
                    onPress={() => setWorkMode(m)}
                  >
                    <Text style={[s.pillText, workMode === m && s.pillTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Priority */}
              <Text style={s.label}>PRIORITY</Text>
              <View style={s.pillRow}>
                {PRIORITIES.map(p => {
                  const active = priority === p.key;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      style={[s.priPill, active && { backgroundColor: p.bg, borderColor: p.color }]}
                      onPress={() => setPriority(p.key)}
                    >
                      <View style={[s.priDot, { backgroundColor: p.color }]} />
                      <Text style={[s.priText, active && { color: p.color, fontWeight: '700' }]}>{p.key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Notify To */}
              <View style={s.notifyHead}>
                <Text style={s.label}>NOTIFY TO</Text>
                <TouchableOpacity onPress={() => setPicker('notify')}>
                  <Text style={s.addPerson}>+ Add Person</Text>
                </TouchableOpacity>
              </View>
              <View style={s.chipWrap}>
                {notify.length === 0 && <Text style={s.notifyEmpty}>No one added</Text>}
                {notify.map(p => (
                  <View key={p.id} style={s.notifyChip}>
                    <View style={s.chipAvatar}><Text style={s.chipAvatarText}>{p.initials}</Text></View>
                    <Text style={s.chipName}>{p.name}</Text>
                    <TouchableOpacity onPress={() => toggleNotify(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={s.chipX}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ═══════ STEP 2 — Describe ═══════ */}
          {step === 2 && (
            <>
              <Text style={s.label}>SUBJECT</Text>
              <TextInput
                style={s.input}
                placeholder="Brief summary of the issue"
                placeholderTextColor="#9CA3AF"
                value={subject}
                onChangeText={setSubject}
                maxLength={120}
              />
              <Text style={s.charCount}>{subject.length}/120</Text>

              <Text style={s.label}>DESCRIPTION</Text>
              <TextInput
                style={[s.input, s.textArea]}
                placeholder="Describe the issue in detail — what happened, when, and any steps to reproduce..."
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDesc}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <Text style={s.label}>ATTACHMENTS (OPTIONAL)</Text>
              <TouchableOpacity
                style={s.attachBtn}
                onPress={() => setAttach(prev => [...prev, `Screenshot_${prev.length + 1}.png`])}
              >
                <Text style={s.attachIcon}>📎</Text>
                <Text style={s.attachText}>Add attachment</Text>
              </TouchableOpacity>
              {attachments.map((a, i) => (
                <View key={i} style={s.fileRow}>
                  <Text style={s.fileIcon}>🖼️</Text>
                  <Text style={s.fileName} numberOfLines={1}>{a}</Text>
                  <TouchableOpacity onPress={() => setAttach(prev => prev.filter((_, idx) => idx !== i))}>
                    <Text style={s.chipX}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* ═══════ STEP 3 — Review ═══════ */}
          {step === 3 && (
            <>
              <Text style={s.reviewHeading}>Review your ticket</Text>
              <Text style={s.reviewSub}>Please confirm the details before submitting.</Text>

              <ReviewRow label="Department"   value={dept?.label} />
              <ReviewRow label="Category"     value={category?.label} />
              <ReviewRow label="Sub Category" value={subCategory ?? undefined} />
              <ReviewRow label="Work Mode"    value={workMode} />
              <ReviewRow
                label="Priority"
                custom={
                  <View style={[s.priPill, { backgroundColor: PRIORITIES.find(p => p.key === priority)?.bg, borderColor: PRIORITIES.find(p => p.key === priority)?.color }]}>
                    <View style={[s.priDot, { backgroundColor: PRIORITIES.find(p => p.key === priority)?.color }]} />
                    <Text style={[s.priText, { color: PRIORITIES.find(p => p.key === priority)?.color, fontWeight: '700' }]}>{priority}</Text>
                  </View>
                }
              />
              <ReviewRow label="Subject" value={subject} />

              <Text style={s.reviewLabel}>DESCRIPTION</Text>
              <Text style={s.reviewDesc}>{description}</Text>

              <Text style={s.reviewLabel}>NOTIFY TO</Text>
              <View style={s.chipWrap}>
                {notify.length === 0
                  ? <Text style={s.notifyEmpty}>No one</Text>
                  : notify.map(p => (
                    <View key={p.id} style={s.notifyChip}>
                      <View style={s.chipAvatar}><Text style={s.chipAvatarText}>{p.initials}</Text></View>
                      <Text style={s.chipName}>{p.name}</Text>
                    </View>
                  ))}
              </View>

              {attachments.length > 0 && (
                <>
                  <Text style={s.reviewLabel}>ATTACHMENTS</Text>
                  {attachments.map((a, i) => (
                    <View key={i} style={s.fileRow}>
                      <Text style={s.fileIcon}>🖼️</Text>
                      <Text style={s.fileName}>{a}</Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </View>

        {/* SLA note */}
        {dept && (
          <View style={s.slaNote}>
            <Text style={s.slaIcon}>ℹ️</Text>
            <Text style={s.slaText}>
              Tickets assigned to <Text style={{ fontWeight: '700' }}>{dept.label}</Text> are usually resolved within {dept.slaHours} hours.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Footer button ── */}
      <View style={s.footer}>
        {step === 1 && (
          <TouchableOpacity
            style={[s.primaryBtn, !canNext1 && s.primaryBtnOff]}
            disabled={!canNext1}
            onPress={() => setStep(2)}
          >
            <Text style={s.primaryText}>Next  →  Describe</Text>
          </TouchableOpacity>
        )}
        {step === 2 && (
          <View style={s.footerRow}>
            <TouchableOpacity style={s.secondaryBtn} onPress={() => setStep(1)}>
              <Text style={s.secondaryText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.primaryBtn, { flex: 1 }, !canNext2 && s.primaryBtnOff]}
              disabled={!canNext2}
              onPress={() => setStep(3)}
            >
              <Text style={s.primaryText}>Next  →  Review</Text>
            </TouchableOpacity>
          </View>
        )}
        {step === 3 && (
          <View style={s.footerRow}>
            <TouchableOpacity style={s.secondaryBtn} onPress={() => setStep(2)}>
              <Text style={s.secondaryText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, { flex: 1, backgroundColor: '#10B981' }]} onPress={submit}>
              <Text style={s.primaryText}>✓  Submit Ticket</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Category picker ── */}
      <Modal visible={picker === 'category'} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Select Category — {dept?.label}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {dept?.categories.map(c => (
                <TouchableOpacity key={c.label} style={s.sheetOption} onPress={() => chooseCategory(c)}>
                  <Text style={[s.sheetOptionText, category?.label === c.label && s.sheetOptionActive]}>{c.label}</Text>
                  <Text style={s.sheetCount}>{c.subcategories.length}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Sub Category picker ── */}
      <Modal visible={picker === 'subcategory'} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Select Sub Category — {category?.label}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {category?.subcategories.map(sub => (
                <TouchableOpacity
                  key={sub}
                  style={s.sheetOption}
                  onPress={() => { setSubCat(sub); setPicker(null); }}
                >
                  <Text style={[s.sheetOptionText, subCategory === sub && s.sheetOptionActive]}>{sub}</Text>
                  {subCategory === sub && <Text style={s.sheetCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Notify picker ── */}
      <Modal visible={picker === 'notify'} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Notify People</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {DIRECTORY.map(p => {
                const on = !!notify.find(x => x.id === p.id);
                return (
                  <TouchableOpacity key={p.id} style={s.personRow} onPress={() => toggleNotify(p)}>
                    <View style={s.chipAvatar}><Text style={s.chipAvatarText}>{p.initials}</Text></View>
                    <Text style={s.personName}>{p.name}</Text>
                    <View style={[s.checkbox, on && s.checkboxOn]}>
                      {on && <Text style={s.checkboxTick}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={[s.primaryBtn, { marginTop: 12 }]} onPress={() => setPicker(null)}>
              <Text style={s.primaryText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ── Review row helper ── */
function ReviewRow({ label, value, custom }: { label: string; value?: string; custom?: React.ReactNode }) {
  return (
    <View style={s.reviewRow}>
      <Text style={s.reviewRowLabel}>{label}</Text>
      {custom ?? <Text style={s.reviewRowVal}>{value ?? '—'}</Text>}
    </View>
  );
}

/* ════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  /* header */
  header: {
    backgroundColor: '#1E1B4B',
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  iconBtn:   { width: 36, alignItems: 'flex-start' },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#FFF' },
  headerStep:  { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  /* progress */
  progressWrap: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#1E1B4B' },
  progressSeg:       { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressSegActive: { backgroundColor: '#A5B4FC' },

  scroll: { flex: 1 },

  card: {
    backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 18,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },

  label: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },

  /* department grid */
  deptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  deptCard: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 14, backgroundColor: '#FAFAFA',
  },
  deptCardActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  deptIcon:       { fontSize: 18 },
  deptLabel:      { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
  deptLabelActive:{ color: '#4F46E5' },
  deptCheck:      { color: '#4F46E5', fontWeight: '800', fontSize: 14 },

  /* dropdown */
  dropdown: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 14, marginBottom: 8, backgroundColor: '#FAFAFA',
  },
  dropdownDisabled:    { backgroundColor: '#F3F4F6', opacity: 0.7 },
  dropdownVal:         { fontSize: 15, color: '#1F2937', fontWeight: '500' },
  dropdownPlaceholder: { fontSize: 14, color: '#9CA3AF' },
  dropdownArrow:       { fontSize: 14, color: '#6B7280' },

  /* pills */
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pill: {
    paddingVertical: 9, paddingHorizontal: 18,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  pillActive:     { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  pillText:       { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  pillTextActive: { color: '#4F46E5' },

  priPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  priDot:  { width: 8, height: 8, borderRadius: 4 },
  priText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },

  /* notify */
  notifyHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addPerson:   { fontSize: 13, color: '#4F46E5', fontWeight: '700' },
  chipWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  notifyEmpty: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  notifyChip:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EEF2FF', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 8,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  chipAvatar:     { width: 22, height: 22, borderRadius: 11, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  chipName:       { fontSize: 12, color: '#3730A3', fontWeight: '600' },
  chipX:          { fontSize: 12, color: '#6B7280', paddingHorizontal: 2 },

  /* step 2 inputs */
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 14, fontSize: 15, color: '#1F2937', backgroundColor: '#FAFAFA',
  },
  textArea:  { minHeight: 130, marginBottom: 8 },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4, marginBottom: 8 },

  attachBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#C7D2FE', borderStyle: 'dashed', borderRadius: 10,
    paddingVertical: 16, backgroundColor: '#F5F3FF', marginBottom: 10,
  },
  attachIcon: { fontSize: 16 },
  attachText: { fontSize: 14, color: '#4F46E5', fontWeight: '600' },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, marginBottom: 6,
  },
  fileIcon: { fontSize: 14 },
  fileName: { flex: 1, fontSize: 13, color: '#374151' },

  /* step 3 review */
  reviewHeading: { fontSize: 17, fontWeight: '800', color: '#1F2937' },
  reviewSub:     { fontSize: 13, color: '#6B7280', marginTop: 2, marginBottom: 12 },
  reviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  reviewRowLabel: { fontSize: 13, color: '#6B7280' },
  reviewRowVal:   { fontSize: 14, color: '#1F2937', fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 12 },
  reviewLabel:    { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.6, marginTop: 14, marginBottom: 6 },
  reviewDesc:     { fontSize: 14, color: '#374151', lineHeight: 20 },

  /* SLA note */
  slaNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginTop: 2,
    backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#4F46E5',
  },
  slaIcon: { fontSize: 13 },
  slaText: { flex: 1, fontSize: 12, color: '#4338CA', lineHeight: 18 },

  /* footer */
  footer: {
    backgroundColor: '#FFF', padding: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 },
  },
  footerRow:    { flexDirection: 'row', gap: 12 },
  primaryBtn:   { backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnOff:{ backgroundColor: '#C4C4DE', opacity: 0.7 },
  primaryText:  { color: '#FFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  secondaryText:{ color: '#6B7280', fontSize: 15, fontWeight: '700' },

  /* sheets */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  sheetOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sheetOptionText:   { fontSize: 15, color: '#374151', flex: 1 },
  sheetOptionActive: { color: '#4F46E5', fontWeight: '700' },
  sheetCount:  { fontSize: 12, color: '#9CA3AF', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  sheetCheck:  { color: '#4F46E5', fontWeight: '700', fontSize: 16 },

  /* person row */
  personRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  personName: { flex: 1, fontSize: 15, color: '#1F2937', fontWeight: '500' },
  checkbox:   { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  checkboxTick: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
