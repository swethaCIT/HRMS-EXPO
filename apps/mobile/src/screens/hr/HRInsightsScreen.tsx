import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Dimensions, RefreshControl,
} from 'react-native';
import Svg, { Circle, Rect, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { HR_PEOPLE } from '../../data/hrData';
import {
  T, ORG_HEADCOUNT, ATTRITION_TREND, ATTRITION_LABELS, GENDER_SPLIT,
} from '../../data/hrData';
import { analyticsApi } from '../../services/api';

const { width } = Dimensions.get('window');
const PALETTE = ['#4F46E5', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#14B8A6', '#EF4444'];
const withColors = (arr: { label: string; value: number }[]) =>
  arr.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));

const TENURE_LABELS = ['< 1 yr', '1–2 yr', '2–3 yr', '3–5 yr', '5 yr+'];
const TENURE_WEIGHTS = [0.18, 0.27, 0.27, 0.18, 0.10];
const HIRES_SERIES = [1, 2, 1, 3, 2, 2]; // new joiners / month

/* ── Donut ── */
function Donut({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const size = 140, stroke = 22, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#F3F4F6" strokeWidth={stroke} fill="none" />
        {data.map((d) => {
          const dash = (d.value / total) * c;
          const seg = (
            <Circle key={d.label} cx={size / 2} cy={size / 2} r={r} stroke={d.color} strokeWidth={stroke} fill="none"
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          );
          offset += dash; return seg;
        })}
      </G>
    </Svg>
  );
}

/* ── Line / area chart ── */
function LineChart({ values, max, color, fill }: { values: number[]; max: number; color: string; fill?: boolean }) {
  const w = width - 64, h = 128, pad = 16;
  const n = values.length;
  const stepX = (w - pad * 2) / Math.max(1, n - 1);
  const yOf = (v: number) => pad + (h - pad * 2) * (1 - v / max);
  const pts = values.map((v, i) => `${pad + stepX * i},${yOf(v)}`).join(' ');
  const baseline = yOf(0);
  const areaPts = `${pad},${baseline} ${pts} ${pad + stepX * (n - 1)},${baseline}`;
  return (
    <Svg width={w} height={h}>
      {[0, max / 2, max].map((g, i) => {
        const y = yOf(g);
        return <Line key={i} x1={0} y1={y} x2={w} y2={y} stroke="#F3F4F6" strokeWidth={1} />;
      })}
      {fill && <Polyline points={areaPts} fill={color} fillOpacity={0.12} stroke="none" />}
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <Circle key={i} cx={pad + stepX * i} cy={yOf(v)} r={4} fill="#FFF" stroke={color} strokeWidth={2.5} />
      ))}
    </Svg>
  );
}

/* ── Grouped bar chart (two series) ── */
function GroupedBars({ a, b, max, ca, cb }: { a: number[]; b: number[]; max: number; ca: string; cb: string }) {
  const w = width - 64, h = 128, pad = 18;
  const n = a.length;
  const slot = (w - pad * 2) / n;
  const barW = slot * 0.28;
  const yBase = h - pad;
  return (
    <Svg width={w} height={h}>
      {[0, max / 2, max].map((g, i) => {
        const y = pad + (h - pad * 2) * (1 - g / max);
        return <Line key={i} x1={0} y1={y} x2={w} y2={y} stroke="#F3F4F6" strokeWidth={1} />;
      })}
      {a.map((_, i) => {
        const cx = pad + slot * i + slot / 2;
        const hA = (h - pad * 2) * (a[i] / max);
        const hB = (h - pad * 2) * (b[i] / max);
        return (
          <G key={i}>
            <Rect x={cx - barW - 2} y={yBase - hA} width={barW} height={hA} rx={3} fill={ca} />
            <Rect x={cx + 2} y={yBase - hB} width={barW} height={hB} rx={3} fill={cb} />
            <SvgText x={cx - barW / 2 - 2} y={yBase - hA - 4} fontSize={9} fontWeight="700" fill={T.faint} textAnchor="middle">{a[i]}</SvgText>
            <SvgText x={cx + barW / 2 + 2} y={yBase - hB - 4} fontSize={9} fontWeight="700" fill={T.faint} textAnchor="middle">{b[i]}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/* ── Semicircle gauge (0–100) ── */
function Gauge({ pct, color = T.primary }: { pct: number; color?: string }) {
  const size = 176, stroke = 18, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const half = c / 2;
  const value = (clamp(pct) / 100) * half;
  const h = size / 2 + stroke;
  return (
    <Svg width={size} height={h}>
      <G rotation="180" origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#F3F4F6" strokeWidth={stroke} fill="none"
          strokeDasharray={`${half} ${c - half}`} strokeLinecap="round" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${value} ${c - value}`} strokeLinecap="round" />
      </G>
    </Svg>
  );
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/* Small ▲/▼ delta pill */
function Delta({ value, suffix = '%', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  const up = value >= 0;
  const good = invert ? !up : up;
  const color = value === 0 ? T.faint : good ? '#10B981' : '#EF4444';
  return (
    <Text style={[st.delta, { color }]}>{value === 0 ? '▬' : up ? '▲' : '▼'} {Math.abs(value)}{suffix}</Text>
  );
}

export default function HRInsightsScreen() {
  const [sum, setSum] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await analyticsApi.summary(); setSum(data); } catch { /* keep mock */ }
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  /* ── Derived from analytics summary (graceful fallback to mock) ── */
  const total = sum?.headcount ?? HR_PEOPLE.length;
  const avgAtt = sum?.avgAttendance ?? Math.round(HR_PEOPLE.reduce((a, p) => a + p.attendancePct, 0) / HR_PEOPLE.length);
  const orgHeadcount = sum?.headcountByDept?.length ? withColors(sum.headcountByDept) : ORG_HEADCOUNT;
  const genderData = sum?.genderSplit?.length ? withColors(sum.genderSplit) : GENDER_SPLIT;
  const departments = sum?.departments ?? orgHeadcount.length;
  const headTotal = orgHeadcount.reduce((a: number, d: any) => a + d.value, 0) || 1;
  const genderTotal = genderData.reduce((a: number, d: any) => a + d.value, 0) || 1;

  const attritionNow = ATTRITION_TREND[ATTRITION_TREND.length - 1];
  const attritionPrev = ATTRITION_TREND[ATTRITION_TREND.length - 2] ?? attritionNow;
  const attritionDelta = attritionNow - attritionPrev;

  /* Headcount growth: cumulative build-up ending at the current headcount. */
  const growth = ATTRITION_LABELS.map((_, i) => Math.max(0, total - (ATTRITION_LABELS.length - 1 - i)));
  const growthMax = Math.max(...growth, 1);
  const growthDelta = growth[growth.length - 1] - growth[0];

  /* Tenure distribution (proportional to headcount, remainder on the largest bucket). */
  let acc = 0;
  const tenure = TENURE_WEIGHTS.map((wgt, i) => {
    const v = i === TENURE_WEIGHTS.length - 1 ? total - acc : Math.round(total * wgt);
    acc += v;
    return { label: TENURE_LABELS[i], value: Math.max(0, v), color: PALETTE[i % PALETTE.length] };
  });
  const tenureMax = Math.max(...tenure.map((t) => t.value), 1);

  /* Talent movement — exits per month derived from attrition rate, hires illustrative. */
  const exitsSeries = ATTRITION_TREND.map((a) => Math.max(0, Math.round((a / 100) * total)));
  const hiresTotal = HIRES_SERIES.reduce((s, v) => s + v, 0);
  const exitsTotal = exitsSeries.reduce((s, v) => s + v, 0);
  const netMovement = hiresTotal - exitsTotal;
  const movementMax = Math.max(...HIRES_SERIES, ...exitsSeries, 1);

  /* Diversity & inclusion */
  const womenRow = genderData.find((d: any) => /women|female/i.test(d.label));
  const womenPct = womenRow ? Math.round((womenRow.value / genderTotal) * 100) : 0;

  const deptDistribution = orgHeadcount.map((d: any, i: number) => ({ ...d, color: d.color ?? PALETTE[i % PALETTE.length] }));

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <Text style={st.hTitle}>Org Insights</Text>
        <Text style={st.hSub}>{total} employees · {departments} departments</Text>
      </View>

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {/* Summary KPI row (4) */}
        <View style={st.kpiRow}>
          {[
            { v: `${total}`, l: 'Headcount', c: '#4F46E5', bg: '#EEF2FF' },
            { v: `${departments}`, l: 'Departments', c: '#0EA5E9', bg: '#E0F2FE' },
            { v: `${avgAtt}%`, l: 'Avg attendance', c: '#10B981', bg: '#ECFDF5' },
            { v: `${attritionNow}%`, l: 'Attrition', c: '#F59E0B', bg: '#FFF7ED' },
          ].map((k) => (
            <View key={k.l} style={[st.kpiCard, { backgroundColor: k.bg }]}>
              <Text style={[st.kpiVal, { color: k.c }]}>{k.v}</Text>
              <Text style={st.kpiLabel}>{k.l}</Text>
            </View>
          ))}
        </View>

        {/* Headcount growth */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>HEADCOUNT GROWTH</Text>
              <Text style={st.cardSub}>Total employees over the last 6 months</Text>
            </View>
            <Delta value={growthDelta} suffix="" />
          </View>
          <LineChart values={growth} max={growthMax} color={T.primary} fill />
          <View style={st.barLabels}>
            {ATTRITION_LABELS.map((l, i) => (
              <Text key={i} style={[st.barLabel, i === ATTRITION_LABELS.length - 1 && { color: T.primary, fontWeight: '700' }]}>{l}</Text>
            ))}
          </View>
        </View>

        {/* Attrition trend */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>ATTRITION TREND</Text>
              <Text style={st.cardSub}>Monthly voluntary attrition · lower is better</Text>
            </View>
            <Delta value={attritionDelta} invert />
          </View>
          <LineChart values={ATTRITION_TREND} max={10} color="#EF4444" />
          <View style={st.barLabels}>
            {ATTRITION_LABELS.map((l, i) => (
              <Text key={i} style={[st.barLabel, i === ATTRITION_LABELS.length - 1 && { color: '#EF4444', fontWeight: '700' }]}>{l}</Text>
            ))}
          </View>
        </View>

        {/* Department distribution donut */}
        <View style={st.card}>
          <Text style={st.cardTitle}>DEPARTMENT DISTRIBUTION</Text>
          <Text style={st.cardSub}>Share of headcount by function</Text>
          <View style={st.donutRow}>
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              <Donut data={deptDistribution} total={headTotal} />
              <View style={st.donutCenter}>
                <Text style={st.donutCenterNum}>{headTotal}</Text>
                <Text style={st.donutCenterLabel}>people</Text>
              </View>
            </View>
            <View style={st.legend}>
              {deptDistribution.map((d: any) => (
                <View key={d.label} style={st.legendRow}>
                  <View style={[st.legendDot, { backgroundColor: d.color }]} />
                  <Text style={st.legendLabel} numberOfLines={1}>{d.label}</Text>
                  <Text style={st.legendPct}>{Math.round((d.value / headTotal) * 100)}%</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Gender diversity donut */}
        <View style={st.card}>
          <Text style={st.cardTitle}>GENDER DIVERSITY</Text>
          <Text style={st.cardSub}>Workforce composition</Text>
          <View style={st.donutRow}>
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              <Donut data={genderData} total={genderTotal} />
              <View style={st.donutCenter}>
                <Text style={st.donutCenterNum}>{genderTotal}</Text>
                <Text style={st.donutCenterLabel}>people</Text>
              </View>
            </View>
            <View style={st.legend}>
              {genderData.map((d: any) => (
                <View key={d.label} style={st.legendRow}>
                  <View style={[st.legendDot, { backgroundColor: d.color }]} />
                  <Text style={st.legendLabel}>{d.label}</Text>
                  <Text style={st.legendVal}>{Math.round((d.value / genderTotal) * 100)}%</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Diversity & Inclusion mini-card */}
        <View style={st.diCard}>
          <View style={st.diItem}>
            <Text style={st.diVal}>{womenPct}%</Text>
            <Text style={st.diLabel}>Women in workforce</Text>
          </View>
          <View style={st.diSep} />
          <View style={st.diItem}>
            <Text style={st.diVal}>{departments}</Text>
            <Text style={st.diLabel}>Functions represented</Text>
          </View>
          <View style={st.diSep} />
          <View style={st.diItem}>
            <Text style={st.diVal}>{genderData.length}</Text>
            <Text style={st.diLabel}>Gender identities</Text>
          </View>
        </View>

        {/* Tenure distribution */}
        <View style={st.card}>
          <Text style={st.cardTitle}>TENURE DISTRIBUTION</Text>
          <Text style={st.cardSub}>Experience with the company</Text>
          {tenure.map((d) => (
            <View key={d.label} style={st.hcRow}>
              <Text style={st.hcLabel}>{d.label}</Text>
              <View style={st.hcTrack}>
                <View style={[st.hcFill, { width: `${(d.value / tenureMax) * 100}%`, backgroundColor: d.color }]} />
              </View>
              <Text style={st.hcVal}>{d.value}</Text>
            </View>
          ))}
        </View>

        {/* Talent movement: hires vs exits */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>NEW HIRES VS EXITS</Text>
              <Text style={st.cardSub}>Talent movement over 6 months</Text>
            </View>
            <Text style={[st.netPill, { color: netMovement >= 0 ? '#10B981' : '#EF4444' }]}>Net {netMovement >= 0 ? '+' : ''}{netMovement}</Text>
          </View>
          <GroupedBars a={HIRES_SERIES} b={exitsSeries} max={movementMax} ca={T.primary} cb="#EF4444" />
          <View style={st.barLabels}>
            {ATTRITION_LABELS.map((l, i) => (<Text key={i} style={st.barLabel}>{l}</Text>))}
          </View>
          <View style={st.legendInline}>
            <View style={st.legendRowInline}><View style={[st.legendDot, { backgroundColor: T.primary }]} /><Text style={st.legendInlineTx}>Hires ({hiresTotal})</Text></View>
            <View style={st.legendRowInline}><View style={[st.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={st.legendInlineTx}>Exits ({exitsTotal})</Text></View>
          </View>
        </View>

        {/* Average attendance gauge */}
        <View style={st.card}>
          <Text style={st.cardTitle}>AVERAGE ATTENDANCE</Text>
          <Text style={st.cardSub}>Org-wide 30-day presence rate</Text>
          <View style={st.gaugeWrap}>
            <View style={{ alignItems: 'center' }}>
              <Gauge pct={avgAtt} color={avgAtt >= 90 ? '#10B981' : avgAtt >= 80 ? T.primary : '#F59E0B'} />
              <View style={st.gaugeCenter}>
                <Text style={st.gaugeNum}>{avgAtt}%</Text>
                <Text style={st.gaugeSub}>attendance</Text>
              </View>
              <View style={st.gaugeScale}>
                <Text style={st.gaugeScaleTx}>0</Text>
                <Text style={st.gaugeScaleTx}>100</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Headcount by department */}
        <View style={[st.card, { marginBottom: 4 }]}>
          <Text style={st.cardTitle}>HEADCOUNT BY DEPARTMENT</Text>
          <Text style={st.cardSub}>Absolute team sizes</Text>
          {orgHeadcount.map((d: any) => (
            <View key={d.label} style={st.hcRow}>
              <Text style={st.hcLabel}>{d.label}</Text>
              <View style={st.hcTrack}>
                <View style={[st.hcFill, { width: `${(d.value / headTotal) * 100}%`, backgroundColor: d.color }]} />
              </View>
              <Text style={st.hcVal}>{d.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 18, paddingHorizontal: 20 },
  hTitle: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  hSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  body: { flex: 1 },

  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiCard: { flex: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center' },
  kpiVal: { fontSize: 19, fontWeight: '800' },
  kpiLabel: { fontSize: 9.5, color: T.sub, marginTop: 4, textAlign: 'center' },
  delta: { fontSize: 11, fontWeight: '700' },

  card: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.8 },
  cardSub: { fontSize: 11.5, color: T.faint, marginTop: 2, marginBottom: 12 },
  netPill: { fontSize: 12, fontWeight: '800' },

  barLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 },
  barLabel: { fontSize: 10.5, color: T.faint, flex: 1, textAlign: 'center' },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutCenterNum: { fontSize: 24, fontWeight: '800', color: T.ink },
  donutCenterLabel: { fontSize: 11, color: T.sub },
  legend: { flex: 1, gap: 9 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 12.5, color: T.ink },
  legendPct: { fontSize: 12.5, fontWeight: '700', color: T.sub, width: 40, textAlign: 'right' },
  legendVal: { fontSize: 13, fontWeight: '700', color: T.ink, width: 44, textAlign: 'right' },
  legendInline: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10 },
  legendRowInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendInlineTx: { fontSize: 12, color: T.sub, fontWeight: '600' },

  diCard: { flexDirection: 'row', backgroundColor: '#312E81', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center' },
  diItem: { flex: 1, alignItems: 'center' },
  diVal: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  diLabel: { fontSize: 10.5, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center' },
  diSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },

  hcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  hcLabel: { width: 88, fontSize: 12, color: T.sub },
  hcTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  hcFill: { height: 10, borderRadius: 5 },
  hcVal: { width: 18, textAlign: 'right', fontSize: 13, fontWeight: '700', color: T.ink },

  gaugeWrap: { alignItems: 'center', marginTop: 4 },
  gaugeCenter: { position: 'absolute', top: 44, alignItems: 'center' },
  gaugeNum: { fontSize: 34, fontWeight: '800', color: T.ink },
  gaugeSub: { fontSize: 12, color: T.sub, marginTop: 2 },
  gaugeScale: { flexDirection: 'row', justifyContent: 'space-between', width: 176, marginTop: 2 },
  gaugeScaleTx: { fontSize: 11, color: T.faint, fontWeight: '600' },
});
