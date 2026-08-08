import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Modal, Alert,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { payrollApi } from '../../services/api';

/* ════════ Currency helper (Indian formatting) ════════ */
const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

/* ════════ Donut chart (react-native-svg) ════════ */
interface Segment { label: string; value: number; color: string; }

function Donut({ segments, size = 168, stroke = 26 }: { segments: Segment[]; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circ   = 2 * Math.PI * radius;
  const total  = segments.reduce((sum, s) => sum + s.value, 0);

  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        {/* track */}
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#F1F1F6" strokeWidth={stroke} fill="none"
        />
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          const dash = frac * circ;
          const el = (
            <Circle
              key={i}
              cx={size / 2} cy={size / 2} r={radius}
              stroke={seg.color} strokeWidth={stroke} fill="none"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
      </G>
    </Svg>
  );
}

/* ════════ Data model ════════ */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = [2026, 2025, 2024];

interface LineItem { label: string; amount: number; note?: string; }

interface PaySlip {
  month: number;        // 0-indexed
  year: number;
  status: 'Paid' | 'Processing';
  paidOn: string;
  earnings: LineItem[];
  deductions: LineItem[];
  employerContrib: LineItem[];
  attendance: { totalDays: number; paidDays: number; present: number; paidLeaves: number; lop: number; weekOffs: number };
}

/* sample current-month slip (replace with API) */
const CURRENT: PaySlip = {
  month: 5, year: 2026, status: 'Paid', paidOn: '30 Jun 2026',
  earnings: [
    { label: 'Basic Salary',        amount: 50000, note: '50% of CTC' },
    { label: 'House Rent Allowance', amount: 25000, note: 'HRA' },
    { label: 'Special Allowance',   amount: 15000 },
    { label: 'Medical Allowance',   amount: 1250 },
    { label: 'Conveyance Allowance', amount: 1600 },
    { label: 'LTA',                 amount: 4000, note: 'Leave Travel' },
    { label: 'Performance Bonus',   amount: 8000 },
  ],
  deductions: [
    { label: 'Provident Fund (PF)', amount: 6000, note: '12% of Basic' },
    { label: 'Income Tax (TDS)',    amount: 9500 },
    { label: 'Professional Tax',    amount: 200 },
    { label: 'Health Insurance',    amount: 800 },
  ],
  employerContrib: [
    { label: 'Employer PF',         amount: 6000 },
    { label: 'Gratuity',            amount: 2404 },
  ],
  attendance: { totalDays: 30, paidDays: 30, present: 22, paidLeaves: 0, lop: 0, weekOffs: 8 },
};

/* salary history (net pay per month) */
const HISTORY = [
  { month: 5, year: 2026, net: 88350, status: 'Paid' as const },
  { month: 4, year: 2026, net: 86950, status: 'Paid' as const },
  { month: 3, year: 2026, net: 88350, status: 'Paid' as const },
  { month: 2, year: 2026, net: 85200, status: 'Paid' as const },
  { month: 1, year: 2026, net: 88350, status: 'Paid' as const },
  { month: 0, year: 2026, net: 87600, status: 'Paid' as const },
];

const NOT_ON_FILE = 'Not on file';

/** Show only the last 4 of an account number, never the whole thing. */
const maskAccount = (last4?: string | null) => (last4 ? `•••••• ${last4}` : NOT_ON_FILE);

const fmtJoinDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : NOT_ON_FILE;

/* ════════════════════════════════════════════════════════ */
export default function PayrollScreen({ navigation }: any) {
  const employee = useSelector((st: RootState) => st.auth.employee);
  const [month, setMonth]       = useState(CURRENT.month);
  const [year, setYear]         = useState(CURRENT.year);
  const [picker, setPicker]     = useState<null | 'month' | 'year'>(null);
  const [slip, setSlip]         = useState<PaySlip>(CURRENT);
  const [offline, setOffline]   = useState(false);

  /**
   * Identity and bank rows come from the signed-in user's own employee record.
   * These were previously hardcoded to one person — so every user was shown
   * someone else's name, PAN and bank IFSC as if it were their own payslip.
   */
  const employeeDetails: [string, string][] = useMemo(() => [
    ['Name', `${employee?.firstName ?? ''} ${employee?.lastName ?? ''}`.trim() || NOT_ON_FILE],
    ['Employee ID', employee?.employeeId ?? NOT_ON_FILE],
    ['Designation', employee?.designation ?? NOT_ON_FILE],
    ['Department', employee?.department ?? NOT_ON_FILE],
    ['Date of Joining', fmtJoinDate(employee?.dateOfJoining)],
    ['PAN', employee?.pan ?? NOT_ON_FILE],
    ['UAN', employee?.uan ?? NOT_ON_FILE],
  ], [employee]);

  const bankDetails: [string, string][] = useMemo(() => [
    ['Bank Name', employee?.bankName ?? NOT_ON_FILE],
    ['Account No.', maskAccount(employee?.bankLast4)],
  ], [employee]);

  // Pull the latest real payslip; rebuild the slip from the DB figures.
  useEffect(() => {
    if (!employee?.id) return;
    (async () => {
      try {
        const { data } = await payrollApi.getByEmployee(employee.id);
        const p = Array.isArray(data) ? data[0] : data;
        setOffline(false);
        if (p) {
          const n = (v: any) => Number(v) || 0;
          setSlip({
            month: (n(p.month) || 6) - 1,
            year: n(p.year) || 2026,
            status: p.status === 'paid' ? 'Paid' : 'Processing',
            paidOn: p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            earnings: [
              { label: 'Basic Salary', amount: n(p.basicSalary) },
              { label: 'Allowances', amount: n(p.allowances) },
            ],
            deductions: [
              { label: 'Deductions', amount: n(p.deductions) },
              { label: 'Income Tax (TDS)', amount: n(p.tax) },
            ],
            employerContrib: [],
            attendance: CURRENT.attendance,
          });
          setMonth((n(p.month) || 6) - 1);
          setYear(n(p.year) || 2026);
        }
      } catch { setOffline(true); /* keep mock */ }
    })();
  }, [employee?.id]);

  const grossEarnings = useMemo(() => slip.earnings.reduce((s, e) => s + e.amount, 0), [slip]);
  const totalDeduct   = useMemo(() => slip.deductions.reduce((s, d) => s + d.amount, 0), [slip]);
  const netPay        = grossEarnings - totalDeduct;

  /* donut: composition of gross earnings (derived from the slip) */
  const DONUT_COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#A855F7'];
  const donutSegments: Segment[] = slip.earnings
    .filter(e => e.amount > 0)
    .map((e, i) => ({ label: e.label, value: e.amount, color: DONUT_COLORS[i % DONUT_COLORS.length] }));

  function download(fmt: 'PDF' | 'Excel') {
    Alert.alert(
      `Download ${fmt}`,
      `Payslip for ${MONTHS[month]} ${year} will be exported as ${fmt}.`,
      [{ text: 'OK' }],
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => navigation?.canGoBack?.() && navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payslip</Text>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.dlBtn} onPress={() => download('PDF')}>
            <Text style={s.dlIcon}>📄</Text>
            <Text style={s.dlText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dlBtn} onPress={() => download('Excel')}>
            <Text style={s.dlIcon}>📊</Text>
            <Text style={s.dlText}>Excel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Month / Year filter ── */}
      <View style={s.filterRow}>
        <TouchableOpacity style={s.filterBox} onPress={() => setPicker('month')}>
          <Text style={s.filterLabel}>MONTH</Text>
          <View style={s.filterValRow}>
            <Text style={s.filterVal}>{MONTHS[month]}</Text>
            <Text style={s.filterArrow}>▾</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.filterBox} onPress={() => setPicker('year')}>
          <Text style={s.filterLabel}>YEAR</Text>
          <View style={s.filterValRow}>
            <Text style={s.filterVal}>{year}</Text>
            <Text style={s.filterArrow}>▾</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {offline && (
          <View style={s.offline}>
            <View style={s.offlineDot} />
            <Text style={s.offlineTx}>Backend unreachable · showing demo data</Text>
          </View>
        )}

        {/* ── Net Pay hero ── */}
        <View style={s.netCard}>
          <View style={s.netTop}>
            <View>
              <Text style={s.netLabel}>NET PAY</Text>
              <Text style={s.netValue}>{inr(netPay)}</Text>
              <Text style={s.netSub}>{MONTHS[slip.month]} {slip.year}</Text>
            </View>
            <View style={s.paidBadge}>
              <Text style={s.paidText}>● {slip.status.toUpperCase()}</Text>
              <Text style={s.paidDate}>Credited {slip.paidOn}</Text>
            </View>
          </View>
          <View style={s.netSplit}>
            <View style={s.netSplitItem}>
              <Text style={s.netSplitLabel}>Gross Earnings</Text>
              <Text style={[s.netSplitVal, { color: '#10B981' }]}>{inr(grossEarnings)}</Text>
            </View>
            <View style={s.netSplitDivider} />
            <View style={s.netSplitItem}>
              <Text style={s.netSplitLabel}>Total Deductions</Text>
              <Text style={[s.netSplitVal, { color: '#EF4444' }]}>− {inr(totalDeduct)}</Text>
            </View>
          </View>
        </View>

        {/* ── Salary composition donut ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>SALARY COMPOSITION</Text>
          <View style={s.donutWrap}>
            <View style={s.donutChart}>
              <Donut segments={donutSegments} />
              <View style={s.donutCenter}>
                <Text style={s.donutCenterLabel}>Gross</Text>
                <Text style={s.donutCenterVal}>{inr(grossEarnings)}</Text>
              </View>
            </View>
            <View style={s.legend}>
              {donutSegments.map(seg => {
                const pct = Math.round((seg.value / grossEarnings) * 100);
                return (
                  <View key={seg.label} style={s.legendRow}>
                    <View style={[s.legendDot, { backgroundColor: seg.color }]} />
                    <Text style={s.legendLabel} numberOfLines={1}>{seg.label}</Text>
                    <Text style={s.legendPct}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Earnings ── */}
        <View style={s.card}>
          <View style={s.sectionHead}>
            <Text style={s.cardTitle}>EARNINGS</Text>
            <Text style={[s.sectionTotal, { color: '#10B981' }]}>{inr(grossEarnings)}</Text>
          </View>
          {slip.earnings.map(item => (
            <View key={item.label} style={s.lineRow}>
              <View style={s.lineLeft}>
                <Text style={s.lineLabel}>{item.label}</Text>
                {item.note && <Text style={s.lineNote}>{item.note}</Text>}
              </View>
              <Text style={s.lineAmount}>{inr(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* ── Deductions ── */}
        <View style={s.card}>
          <View style={s.sectionHead}>
            <Text style={s.cardTitle}>DEDUCTIONS</Text>
            <Text style={[s.sectionTotal, { color: '#EF4444' }]}>− {inr(totalDeduct)}</Text>
          </View>
          {slip.deductions.map(item => (
            <View key={item.label} style={s.lineRow}>
              <View style={s.lineLeft}>
                <Text style={s.lineLabel}>{item.label}</Text>
                {item.note && <Text style={s.lineNote}>{item.note}</Text>}
              </View>
              <Text style={[s.lineAmount, { color: '#EF4444' }]}>− {inr(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* ── Net pay summary strip ── */}
        <View style={s.netStrip}>
          <Text style={s.netStripLabel}>Net Pay (Gross − Deductions)</Text>
          <Text style={s.netStripVal}>{inr(netPay)}</Text>
        </View>

        {/* ── Employer contributions ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>EMPLOYER CONTRIBUTIONS</Text>
          <Text style={s.cardSubtitle}>Not deducted from salary — added to your benefits</Text>
          {slip.employerContrib.map(item => (
            <View key={item.label} style={s.lineRow}>
              <Text style={s.lineLabel}>{item.label}</Text>
              <Text style={s.lineAmount}>{inr(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* ── Attendance ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>ATTENDANCE (THIS CYCLE)</Text>
          <View style={s.attGrid}>
            {[
              { label: 'Paid Days',   value: slip.attendance.paidDays,  color: '#4F46E5' },
              { label: 'Present',     value: slip.attendance.present,   color: '#10B981' },
              { label: 'Paid Leaves', value: slip.attendance.paidLeaves, color: '#06B6D4' },
              { label: 'LOP Days',    value: slip.attendance.lop,       color: '#EF4444' },
              { label: 'Week-offs',   value: slip.attendance.weekOffs,  color: '#F59E0B' },
              { label: 'Total Days',  value: slip.attendance.totalDays, color: '#6B7280' },
            ].map(a => (
              <View key={a.label} style={s.attCell}>
                <Text style={[s.attValue, { color: a.color }]}>{a.value}</Text>
                <Text style={s.attLabel}>{a.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Employee details ── (from the signed-in user's own record) */}
        <View style={s.card}>
          <Text style={s.cardTitle}>EMPLOYEE DETAILS</Text>
          {employeeDetails.map(([k, v]) => (
            <View key={k} style={s.kvRow}>
              <Text style={s.kvKey}>{k}</Text>
              <Text style={s.kvVal}>{v}</Text>
            </View>
          ))}
        </View>

        {/* ── Bank details ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>BANK DETAILS</Text>
          {bankDetails.map(([k, v]) => (
            <View key={k} style={s.kvRow}>
              <Text style={s.kvKey}>{k}</Text>
              <Text style={s.kvVal}>{v}</Text>
            </View>
          ))}
          {!employee?.bankName && (
            <Text style={s.kvNote}>
              Bank details are not on file. Ask HR to add them to your profile.
            </Text>
          )}
        </View>

        {/* ── Salary history ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>SALARY HISTORY</Text>
          {HISTORY.map(h => (
            <TouchableOpacity
              key={`${h.month}-${h.year}`}
              style={s.histRow}
              activeOpacity={0.7}
              onPress={() => { setMonth(h.month); setYear(h.year); }}
            >
              <View>
                <Text style={s.histMonth}>{MONTHS[h.month]} {h.year}</Text>
                <Text style={s.histStatus}>● {h.status}</Text>
              </View>
              <View style={s.histRight}>
                <Text style={s.histNet}>{inr(h.net)}</Text>
                <Text style={s.histArrow}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Download buttons ── */}
        <View style={s.downloadRow}>
          <TouchableOpacity style={[s.downloadBtn, s.pdfBtn]} onPress={() => download('PDF')}>
            <Text style={s.downloadIcon}>📄</Text>
            <Text style={s.downloadText}>Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.downloadBtn, s.excelBtn]} onPress={() => download('Excel')}>
            <Text style={s.downloadIcon}>📊</Text>
            <Text style={[s.downloadText, { color: '#065F46' }]}>Export Excel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Month / Year picker ── */}
      <Modal visible={picker !== null} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Select {picker === 'month' ? 'Month' : 'Year'}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {(picker === 'month' ? MONTHS.map((m, i) => ({ label: m, val: i })) : YEARS.map(y => ({ label: String(y), val: y }))).map(opt => {
                const active = picker === 'month' ? opt.val === month : opt.val === year;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={s.sheetOption}
                    onPress={() => {
                      picker === 'month' ? setMonth(opt.val) : setYear(opt.val);
                      setPicker(null);
                    }}
                  >
                    <Text style={[s.sheetOptionText, active && s.sheetOptionActive]}>{opt.label}</Text>
                    {active && <Text style={s.sheetCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  /* header */
  header: {
    backgroundColor: '#1E1B4B',
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  iconBtn:       { width: 32, alignItems: 'flex-start' },
  backArrow:     { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerTitle:   { flex: 1, fontSize: 20, fontWeight: '700', color: '#FFF' },
  headerActions: { flexDirection: 'row', gap: 8 },
  dlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  dlIcon: { fontSize: 13 },
  dlText: { fontSize: 12, color: '#FFF', fontWeight: '600' },

  /* filter */
  filterRow: {
    flexDirection: 'row', gap: 12,
    backgroundColor: '#1E1B4B',
    paddingHorizontal: 16, paddingBottom: 16,
  },
  filterBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10, padding: 12,
  },
  filterLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  filterValRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterVal:    { fontSize: 15, color: '#FFF', fontWeight: '700' },
  filterArrow:  { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  scroll: { flex: 1 },

  /* offline banner */
  offline: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginHorizontal: 16, marginTop: 12 },
  offlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },
  offlineTx: { fontSize: 12, color: '#B45309', fontWeight: '600' },

  /* net hero */
  netCard: {
    backgroundColor: '#FFF', margin: 16, marginBottom: 12,
    borderRadius: 16, padding: 18,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  netTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  netLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.8 },
  netValue: { fontSize: 32, fontWeight: '800', color: '#1F2937', marginTop: 2 },
  netSub:   { fontSize: 13, color: '#6B7280', marginTop: 2 },
  paidBadge:{ alignItems: 'flex-end' },
  paidText: { fontSize: 11, fontWeight: '800', color: '#10B981', letterSpacing: 0.5 },
  paidDate: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
  netSplit: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  netSplitItem:    { flex: 1 },
  netSplitDivider: { width: 1, height: 36, backgroundColor: '#F3F4F6' },
  netSplitLabel:   { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  netSplitVal:     { fontSize: 17, fontWeight: '700' },

  /* generic card */
  card: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardTitle:    { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.8 },
  cardSubtitle: { fontSize: 11, color: '#9CA3AF', marginTop: 4, marginBottom: 4 },

  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTotal: { fontSize: 14, fontWeight: '800' },

  /* donut */
  donutWrap:  { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  donutChart: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center' },
  donutCenter:{ position: 'absolute', alignItems: 'center' },
  donutCenterLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  donutCenterVal:   { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  legend:     { flex: 1, paddingLeft: 16, gap: 10 },
  legendRow:  { flexDirection: 'row', alignItems: 'center' },
  legendDot:  { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendLabel:{ flex: 1, fontSize: 12, color: '#374151', fontWeight: '500' },
  legendPct:  { fontSize: 12, color: '#1F2937', fontWeight: '700' },

  /* line items */
  lineRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  lineLeft:   { flex: 1 },
  lineLabel:  { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  lineNote:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  lineAmount: { fontSize: 14, fontWeight: '700', color: '#1F2937' },

  /* net strip */
  netStrip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1E1B4B', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
  },
  netStripLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  netStripVal:   { fontSize: 20, fontWeight: '800', color: '#FFF' },

  /* attendance */
  attGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  attCell: {
    width: '33.33%', alignItems: 'center', paddingVertical: 12,
  },
  attValue: { fontSize: 22, fontWeight: '800' },
  attLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },

  /* key-value */
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  kvKey: { fontSize: 13, color: '#6B7280' },
  kvVal: { fontSize: 13, color: '#1F2937', fontWeight: '600' },
  kvNote: { fontSize: 11.5, color: '#9CA3AF', marginTop: 8, lineHeight: 16 },

  /* history */
  histRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  histMonth:  { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  histStatus: { fontSize: 11, color: '#10B981', fontWeight: '600', marginTop: 2 },
  histRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histNet:    { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  histArrow:  { fontSize: 20, color: '#D1D5DB' },

  /* download buttons */
  downloadRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 4 },
  downloadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 15 },
  pdfBtn:      { backgroundColor: '#4F46E5' },
  excelBtn:    { backgroundColor: '#D1FAE5' },
  downloadIcon:{ fontSize: 16 },
  downloadText:{ fontSize: 14, fontWeight: '700', color: '#FFF' },

  /* picker sheet */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  sheetOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sheetOptionText:   { fontSize: 15, color: '#374151' },
  sheetOptionActive: { color: '#4F46E5', fontWeight: '700' },
  sheetCheck:        { color: '#4F46E5', fontWeight: '700', fontSize: 16 },
});
