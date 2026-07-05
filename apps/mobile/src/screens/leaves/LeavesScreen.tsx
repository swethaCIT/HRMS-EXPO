import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, Dimensions, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { leaveApi } from '../../services/api';

const { width } = Dimensions.get('window');

/* Map the UI leave-type labels to the backend LeaveType enum values. */
const TYPE_MAP: Record<string, string> = {
  'Casual Leave': 'annual',
  'Sick Leave': 'sick',
  'Annual Leave': 'annual',
  'Emergency Leave': 'emergency',
  'Unpaid Leave': 'unpaid',
};
/* Reverse of TYPE_MAP: backend enum → readable label for the requests list. */
const TYPE_LABEL: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  emergency: 'Emergency Leave',
  unpaid: 'Unpaid Leave',
  casual: 'Casual Leave',
};

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface MyLeave {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: LeaveStatus;
  reason?: string;
}

/* Status chip palette (pending=amber, approved=green, rejected=red, cancelled=gray). */
const LEAVE_STATUS: Record<LeaveStatus, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FEF3C7', color: '#B45309', label: 'Pending' },
  approved:  { bg: '#D1FAE5', color: '#065F46', label: 'Approved' },
  rejected:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
  cancelled: { bg: '#F3F4F6', color: '#6B7280', label: 'Cancelled' },
};

const CELL = Math.floor((width - 64) / 7);

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['S','M','T','W','T','F','S'];
const LEAVE_TYPES = ['Casual Leave','Sick Leave','Annual Leave','Emergency Leave','Unpaid Leave'];

/* ── helpers ── */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function isInRange(d: Date, from: Date | null, to: Date | null): boolean {
  if (!from || !to) return false;
  const t = d.getTime();
  const lo = Math.min(from.getTime(), to.getTime());
  const hi = Math.max(from.getTime(), to.getTime());
  return t > lo && t < hi;
}
function calendarGrid(year: number, month: number): { date: Date; cur: boolean }[] {
  const first     = new Date(year, month, 1).getDay();
  const total     = new Date(year, month + 1, 0).getDate();
  const prevTotal = new Date(year, month, 0).getDate();
  const days: { date: Date; cur: boolean }[] = [];
  for (let i = first - 1; i >= 0; i--)
    days.push({ date: new Date(year, month - 1, prevTotal - i), cur: false });
  for (let d = 1; d <= total; d++)
    days.push({ date: new Date(year, month, d), cur: true });
  let nx = 1;
  while (days.length < 42) days.push({ date: new Date(year, month + 1, nx++), cur: false });
  return days;
}
function countDays(from: Date, to: Date): number {
  return Math.floor(Math.abs(to.getTime() - from.getTime()) / 86400000) + 1;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtISO(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

/* ── mock attendance (replace with API data) ── */
const ATTENDANCE: Record<string, 'present' | 'leave' | 'wfh'> = {
  '2026-06-01':'present','2026-06-02':'present','2026-06-03':'present',
  '2026-06-04':'wfh',    '2026-06-05':'present',
  '2026-06-08':'leave',  '2026-06-09':'present','2026-06-10':'present',
  '2026-06-11':'wfh',    '2026-06-12':'present','2026-06-13':'present',
  '2026-06-16':'present','2026-06-17':'present','2026-06-18':'present',
  '2026-06-19':'leave',  '2026-06-20':'present',
  '2026-06-23':'present','2026-06-24':'present','2026-06-25':'present',
  '2026-06-26':'present',
};

/* ════════════════════════════════════════════════ */
export default function LeavesScreen({ navigation }: any) {
  const employee = useSelector((st: RootState) => st.auth.employee);
  const today = new Date();
  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth());
  const [fromDate, setFromDate]   = useState<Date | null>(null);
  const [toDate, setToDate]       = useState<Date | null>(null);
  const [selecting, setSelecting] = useState<'from'|'to'|null>(null);
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [reason, setReason]       = useState('');
  const [showPicker, setShowPicker]   = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [myLeaves, setMyLeaves]       = useState<MyLeave[]>([]);

  /* fetch this employee's leave requests on mount / when the profile loads */
  const loadLeaves = React.useCallback(async () => {
    if (!employee?.id) return;
    try {
      const { data } = await leaveApi.getByEmployee(employee.id);
      if (Array.isArray(data)) setMyLeaves(data as MyLeave[]);
    } catch { /* offline: keep whatever we already have */ }
  }, [employee?.id]);
  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  const grid = calendarGrid(year, month);
  const rows: typeof grid[] = Array.from({ length: 6 }, (_, i) => grid.slice(i * 7, i * 7 + 7));

  /* nav */
  function prevMonth() { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  function nextMonth() { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }

  /* calendar tap */
  function handleDayPress(date: Date) {
    if (!selecting) return;
    if (selecting === 'from') {
      setFromDate(date); setToDate(null); setSelecting('to');
    } else {
      if (fromDate && date < fromDate) { setToDate(fromDate); setFromDate(date); }
      else setToDate(date);
      setSelecting(null);
    }
  }

  /* submit — creates a real leave request when we have the employee profile */
  async function handleSubmit() {
    if (!fromDate || !toDate || !reason.trim()) return;
    if (employee?.id) {
      try {
        await leaveApi.create({
          employeeId: employee.id,
          type: TYPE_MAP[leaveType] ?? 'annual',
          startDate: dateKey(fromDate),
          endDate: dateKey(toDate),
          reason,
        });
        await loadLeaves(); // refresh "My Leave Requests" with the new row
      } catch { /* offline: still show the confirmation */ }
    }
    setShowSummary(true);
  }

  /* employee self-service: withdraw a still-pending request */
  function handleWithdraw(id: string) {
    Alert.alert('Withdraw Leave', 'Withdraw this leave request?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          // optimistic: flip to cancelled immediately
          setMyLeaves(prev => prev.map(l => (l.id === id ? { ...l, status: 'cancelled' } : l)));
          try { await leaveApi.cancel(id); } catch { /* offline: keep optimistic state */ }
          loadLeaves();
        },
      },
    ]);
  }

  function resetForm() {
    setFromDate(null); setToDate(null);
    setReason(''); setLeaveType('Casual Leave');
    setSelecting(null); setShowSummary(false);
  }

  /* ── render ── */
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* Header */}
      <View style={s.header}>
        {navigation?.canGoBack?.() ? (
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.backBtn} />
        )}
        <Text style={s.headerTitle}>Leave</Text>
        <Text style={s.headerRight}>Report</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Calendar Card ── */}
        <View style={s.card}>
          {/* Month nav */}
          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Text style={s.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Text style={s.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day labels */}
          <View style={s.dayLabelRow}>
            {DAY_LABELS.map((d, i) => (
              <View key={i} style={s.dayLabelCell}>
                <Text style={s.dayLabelText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={s.row}>
              {row.map((cell, ci) => {
                const key       = dateKey(cell.date);
                const isToday   = sameDay(cell.date, today);
                const isFrom    = sameDay(cell.date, fromDate);
                const isTo      = sameDay(cell.date, toDate);
                const inRange   = isInRange(cell.date, fromDate, toDate);
                const att       = ATTENDANCE[key];
                const isEnd     = isFrom || isTo;
                const isWeekend = cell.date.getDay()===0 || cell.date.getDay()===6;

                /* range bar positions */
                const isRangeStart = isFrom && toDate;
                const isRangeEnd   = isTo && fromDate;

                return (
                  <TouchableOpacity
                    key={ci}
                    style={s.cell}
                    onPress={() => cell.cur && handleDayPress(cell.date)}
                    activeOpacity={cell.cur ? 0.7 : 1}
                  >
                    {/* range bar background */}
                    {(inRange || isRangeStart || isRangeEnd) && (
                      <View style={[
                        s.rangeBar,
                        isRangeStart && { left: '50%' },
                        isRangeEnd   && { right: '50%' },
                      ]} />
                    )}

                    {/* circle */}
                    <View style={[
                      s.circle,
                      isEnd  && s.circleSelected,
                      !isEnd && isToday && s.circleToday,
                      !isEnd && !isToday && att==='leave' && s.circleLeave,
                      !isEnd && !isToday && att==='wfh'   && s.circleWfh,
                    ]}>
                      <Text style={[
                        s.dayNum,
                        !cell.cur && s.dayNumFaded,
                        (isEnd || isToday || att==='leave' || att==='wfh') && cell.cur && s.dayNumWhite,
                        isWeekend && cell.cur && !isEnd && !isToday && s.dayNumWeekend,
                      ]}>
                        {cell.date.getDate()}
                      </Text>
                    </View>

                    {/* green dot for present */}
                    {!isEnd && !isToday && att==='present' && cell.cur && (
                      <View style={s.presentDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Legend chips */}
          <View style={s.legend}>
            <View style={s.chip}><View style={[s.dot, { backgroundColor:'#10B981' }]} /><Text style={s.chipText}>Casual Leave: 8</Text></View>
            <View style={s.chip}><View style={[s.dot, { backgroundColor:'#3B82F6' }]} /><Text style={s.chipText}>Sick Leave: 5</Text></View>
            <View style={s.chip}><View style={[s.dot, { backgroundColor:'#8B5CF6' }]} /><Text style={s.chipText}>Annual</Text></View>
          </View>

          {/* Color key */}
          <View style={[s.legend, { marginTop: 6 }]}>
            <View style={s.chip}><View style={[s.dot, { backgroundColor:'#10B981' }]} /><Text style={s.chipText}>Present</Text></View>
            <View style={s.chip}><View style={[s.dot, { backgroundColor:'#EF4444' }]} /><Text style={s.chipText}>Leave</Text></View>
            <View style={s.chip}><View style={[s.dot, { backgroundColor:'#F59E0B' }]} /><Text style={s.chipText}>WFH</Text></View>
            <View style={s.chip}><View style={[s.dot, { backgroundColor:'#4F46E5' }]} /><Text style={s.chipText}>Selecting</Text></View>
          </View>
        </View>

        {/* ── Apply Leave Form ── */}
        <View style={[s.card, { marginTop: 8 }]}>
          <Text style={s.formTitle}>APPLY LEAVE</Text>

          {/* Leave Type */}
          <Text style={s.label}>Leave Type</Text>
          <TouchableOpacity style={s.dropdown} onPress={() => setShowPicker(true)}>
            <Text style={s.dropdownText}>{leaveType}</Text>
            <Text style={s.dropdownArrow}>▾</Text>
          </TouchableOpacity>

          {/* From / To */}
          <View style={s.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>From Date</Text>
              <TouchableOpacity
                style={[s.dateBox, selecting==='from' && s.dateBoxActive]}
                onPress={() => { setFromDate(null); setToDate(null); setSelecting('from'); }}
              >
                <Text style={fromDate ? s.dateVal : s.datePlaceholder}>
                  {fromDate ? fromDate.toLocaleDateString('en-GB') : 'DD/MM/YYYY'}
                </Text>
                <Text>📅</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={s.label}>To Date</Text>
              <TouchableOpacity
                style={[s.dateBox, selecting==='to' && s.dateBoxActive]}
                onPress={() => fromDate && setSelecting('to')}
              >
                <Text style={toDate ? s.dateVal : s.datePlaceholder}>
                  {toDate ? toDate.toLocaleDateString('en-GB') : 'DD/MM/YYYY'}
                </Text>
                <Text>📅</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tap hint */}
          {selecting && (
            <View style={s.hint}>
              <Text style={s.hintText}>
                {selecting==='from' ? '👆 Tap a date on the calendar above to set From Date' : '👆 Tap a date on the calendar above to set To Date'}
              </Text>
            </View>
          )}

          {/* Reason */}
          <Text style={s.label}>Reason</Text>
          <TextInput
            style={s.reason}
            placeholder="Explain the reason for leave..."
            placeholderTextColor="#9CA3AF"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, (!fromDate || !toDate || !reason.trim()) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
          >
            <Text style={s.submitText}>Submit Leave Request</Text>
          </TouchableOpacity>
        </View>

        {/* ── My Leave Requests ── */}
        <View style={[s.card, { marginTop: 8 }]}>
          <Text style={s.formTitle}>MY LEAVE REQUESTS</Text>

          {myLeaves.length === 0 ? (
            <Text style={s.emptyLeaves}>No leave requests yet.</Text>
          ) : (
            myLeaves.map((lv) => {
              const cfg = LEAVE_STATUS[lv.status] ?? LEAVE_STATUS.pending;
              return (
                <View key={lv.id} style={s.leaveItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.leaveType}>{TYPE_LABEL[lv.type] ?? lv.type}</Text>
                    <Text style={s.leaveDates}>
                      {fmtISO(lv.startDate)} – {fmtISO(lv.endDate)} · {lv.totalDays} {lv.totalDays === 1 ? 'day' : 'days'}
                    </Text>
                  </View>
                  <View style={s.leaveRight}>
                    <View style={[s.statusChip, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    {lv.status === 'pending' && (
                      <TouchableOpacity
                        style={s.withdrawBtn}
                        onPress={() => handleWithdraw(lv.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.withdrawText}>Withdraw</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── Leave Type Picker ── */}
      <Modal visible={showPicker} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Select Leave Type</Text>
            {LEAVE_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.sheetOption, t===leaveType && s.sheetOptionActive]}
                onPress={() => { setLeaveType(t); setShowPicker(false); }}
              >
                <Text style={[s.sheetOptionText, t===leaveType && s.sheetOptionTextActive]}>{t}</Text>
                {t===leaveType && <Text style={{ color:'#4F46E5', fontWeight:'700' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Summary Modal ── */}
      <Modal visible={showSummary} transparent animationType="fade">
        <View style={s.summaryOverlay}>
          <View style={s.summaryCard}>
            {/* icon */}
            <View style={s.successCircle}><Text style={{ fontSize:32 }}>✅</Text></View>
            <Text style={s.summaryTitle}>Leave Request Submitted</Text>
            <Text style={s.summarySubtitle}>Your request has been sent for approval</Text>

            {/* details */}
            <View style={s.summaryBox}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Leave Type</Text>
                <View style={s.typeBadge}><Text style={s.typeBadgeText}>{leaveType}</Text></View>
              </View>
              <View style={s.divider} />
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>From</Text>
                <Text style={s.summaryValue}>{fromDate ? fmtDate(fromDate) : '--'}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>To</Text>
                <Text style={s.summaryValue}>{toDate ? fmtDate(toDate) : '--'}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Total Days</Text>
                <View style={s.daysBadge}>
                  <Text style={s.daysText}>
                    {fromDate && toDate ? countDays(fromDate, toDate) : 0} Days
                  </Text>
                </View>
              </View>
              {reason.trim() ? (
                <>
                  <View style={s.divider} />
                  <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Reason</Text>
                    <Text style={[s.summaryValue, { flex:1, textAlign:'right', marginLeft:12 }]} numberOfLines={2}>{reason}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <TouchableOpacity style={s.doneBtn} onPress={resetForm}>
              <Text style={s.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  /* header */
  header: {
    backgroundColor: '#1E1B4B',
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn:      { padding: 4 },
  backArrow:    { fontSize: 22, color: '#FFF', fontWeight: '600' },
  headerTitle:  { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 18, fontWeight: '700' },
  headerRight:  { fontSize: 13, color: 'rgba(255,255,255,0.65)' },

  scroll: { flex: 1 },

  /* shared card */
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width:0, height:2 },
  },

  /* calendar month nav */
  monthNav:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  navArrow:   { fontSize:26, color:'#1F2937', fontWeight:'600', paddingHorizontal:8 },
  monthLabel: { fontSize:16, fontWeight:'700', color:'#1F2937' },

  /* day label row */
  dayLabelRow:  { flexDirection:'row', marginBottom:4 },
  dayLabelCell: { width:CELL, alignItems:'center', paddingVertical:4 },
  dayLabelText: { fontSize:12, color:'#9CA3AF', fontWeight:'600' },

  /* grid */
  row:  { flexDirection:'row' },
  cell: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* range bar */
  rangeBar: {
    position: 'absolute',
    left: 0, right: 0,
    height: 32,
    backgroundColor: '#EDE9FE',
    top: (CELL - 32) / 2,
  },

  /* date circle */
  circle:         { width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center' },
  circleToday:    { backgroundColor:'#1E1B4B' },
  circleSelected: { backgroundColor:'#4F46E5' },
  circleLeave:    { backgroundColor:'#EF4444' },
  circleWfh:      { backgroundColor:'#F59E0B' },

  dayNum:        { fontSize:13, fontWeight:'500', color:'#1F2937' },
  dayNumFaded:   { color:'#D1D5DB' },
  dayNumWhite:   { color:'#FFF', fontWeight:'700' },
  dayNumWeekend: { color:'#9CA3AF' },

  /* present dot */
  presentDot: {
    position:'absolute', bottom:4,
    width:4, height:4, borderRadius:2,
    backgroundColor:'#10B981',
  },

  /* legend */
  legend: { flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:12 },
  chip:   { flexDirection:'row', alignItems:'center', gap:4 },
  dot:    { width:8, height:8, borderRadius:4 },
  chipText: { fontSize:11, color:'#6B7280', fontWeight:'500' },

  /* form */
  formTitle: { fontSize:12, fontWeight:'700', color:'#374151', letterSpacing:0.8, marginBottom:16 },
  label:     { fontSize:13, color:'#374151', fontWeight:'600', marginBottom:8 },

  dropdown: {
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    borderWidth:1, borderColor:'#E5E7EB', borderRadius:10,
    padding:14, marginBottom:16, backgroundColor:'#FAFAFA',
  },
  dropdownText:  { fontSize:15, color:'#1F2937', fontWeight:'500' },
  dropdownArrow: { fontSize:16, color:'#6B7280' },

  dateRow:      { flexDirection:'row', gap:12, marginBottom:12 },
  dateBox:      {
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    borderWidth:1, borderColor:'#E5E7EB', borderRadius:10,
    padding:12, backgroundColor:'#FAFAFA',
  },
  dateBoxActive: { borderColor:'#4F46E5', backgroundColor:'#F5F3FF' },
  datePlaceholder: { fontSize:13, color:'#9CA3AF' },
  dateVal:         { fontSize:13, color:'#1F2937', fontWeight:'600' },

  hint: {
    backgroundColor:'#F5F3FF', borderRadius:8, padding:10,
    marginBottom:14, borderLeftWidth:3, borderLeftColor:'#4F46E5',
  },
  hintText: { fontSize:12, color:'#4F46E5', fontWeight:'500', lineHeight:18 },

  reason: {
    borderWidth:1, borderColor:'#E5E7EB', borderRadius:10,
    padding:12, fontSize:14, color:'#1F2937',
    backgroundColor:'#FAFAFA', minHeight:100,
    marginBottom:20,
  },

  submitBtn:         { backgroundColor:'#4F46E5', borderRadius:12, padding:16, alignItems:'center' },
  submitBtnDisabled: { backgroundColor:'#C4C4DE', opacity: 0.7 },
  submitText:        { color:'#FFF', fontSize:16, fontWeight:'700' },

  /* my leave requests */
  emptyLeaves: { fontSize:13, color:'#9CA3AF', paddingVertical:8 },
  leaveItem: {
    flexDirection:'row', alignItems:'center', gap:12,
    paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#F3F4F6',
  },
  leaveType:  { fontSize:14, fontWeight:'700', color:'#1F2937' },
  leaveDates: { fontSize:12, color:'#6B7280', marginTop:3 },
  leaveRight: { alignItems:'flex-end', gap:6 },
  statusChip:     { borderRadius:6, paddingHorizontal:10, paddingVertical:3 },
  statusChipText: { fontSize:11, fontWeight:'700' },
  withdrawBtn: {
    borderWidth:1, borderColor:'#FCA5A5', borderRadius:8,
    paddingHorizontal:10, paddingVertical:4, backgroundColor:'#FEF2F2',
  },
  withdrawText: { fontSize:11, fontWeight:'700', color:'#DC2626' },

  /* leave type sheet */
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  sheet: {
    backgroundColor:'#FFF', borderTopLeftRadius:24, borderTopRightRadius:24,
    padding:24, paddingTop:16,
  },
  sheetHandle:          { width:40, height:4, borderRadius:2, backgroundColor:'#E5E7EB', alignSelf:'center', marginBottom:16 },
  sheetTitle:           { fontSize:16, fontWeight:'700', color:'#1F2937', marginBottom:12 },
  sheetOption:          { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  sheetOptionActive:    { },
  sheetOptionText:      { fontSize:15, color:'#374151' },
  sheetOptionTextActive:{ color:'#4F46E5', fontWeight:'700' },

  /* summary modal */
  summaryOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', padding:24 },
  summaryCard:    { backgroundColor:'#FFF', borderRadius:24, padding:24, alignItems:'center' },
  successCircle:  {
    width:72, height:72, borderRadius:36,
    backgroundColor:'#D1FAE5', alignItems:'center', justifyContent:'center', marginBottom:12,
  },
  summaryTitle:    { fontSize:18, fontWeight:'800', color:'#1F2937', marginBottom:4 },
  summarySubtitle: { fontSize:13, color:'#6B7280', marginBottom:20 },

  summaryBox: { width:'100%', borderRadius:12, borderWidth:1, borderColor:'#F3F4F6', marginBottom:20, overflow:'hidden' },
  summaryRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:12, paddingHorizontal:14 },
  divider:    { height:1, backgroundColor:'#F3F4F6' },
  summaryLabel: { fontSize:13, color:'#6B7280', fontWeight:'500' },
  summaryValue: { fontSize:14, color:'#1F2937', fontWeight:'600' },

  typeBadge:     { backgroundColor:'#EDE9FE', borderRadius:8, paddingHorizontal:10, paddingVertical:4 },
  typeBadgeText: { color:'#4F46E5', fontWeight:'700', fontSize:12 },

  daysBadge: { backgroundColor:'#D1FAE5', borderRadius:8, paddingHorizontal:12, paddingVertical:4 },
  daysText:  { color:'#065F46', fontWeight:'700', fontSize:14 },

  doneBtn:     { backgroundColor:'#4F46E5', borderRadius:12, paddingVertical:14, paddingHorizontal:48 },
  doneBtnText: { color:'#FFF', fontSize:16, fontWeight:'700' },
});
