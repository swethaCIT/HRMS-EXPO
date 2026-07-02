import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Dimensions,
} from 'react-native';
import Svg, { Circle, Rect, G, Line, Polyline } from 'react-native-svg';
import { HR_PEOPLE } from '../../data/hrData';
import {
  T, ORG_HEADCOUNT, ATTRITION_TREND, ATTRITION_LABELS, GENDER_SPLIT,
} from '../../data/hrData';
import { analyticsApi } from '../../services/api';

const { width } = Dimensions.get('window');
const PALETTE = ['#4F46E5', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#14B8A6', '#EF4444'];
const withColors = (arr: { label: string; value: number }[]) =>
  arr.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));

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
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} />
          );
          offset += dash; return seg;
        })}
      </G>
    </Svg>
  );
}

/* Attrition line chart (lower is better) */
function LineChart({ values, max }: { values: number[]; max: number }) {
  const w = width - 64, h = 120, pad = 14;
  const stepX = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + stepX * i;
    const y = pad + (h - pad * 2) * (1 - v / max);
    return `${x},${y}`;
  }).join(' ');
  return (
    <Svg width={w} height={h}>
      {[0, max / 2, max].map((g, i) => {
        const y = pad + (h - pad * 2) * (1 - g / max);
        return <Line key={i} x1={0} y1={y} x2={w} y2={y} stroke="#F3F4F6" strokeWidth={1} />;
      })}
      <Polyline points={pts} fill="none" stroke={T.primary} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => {
        const x = pad + stepX * i;
        const y = pad + (h - pad * 2) * (1 - v / max);
        return <Circle key={i} cx={x} cy={y} r={4} fill="#FFF" stroke={T.primary} strokeWidth={2.5} />;
      })}
    </Svg>
  );
}

export default function HRInsightsScreen() {
  const [sum, setSum] = useState<any>(null);
  useEffect(() => {
    (async () => { try { const { data } = await analyticsApi.summary(); setSum(data); } catch { /* keep mock */ } })();
  }, []);

  const total = sum?.headcount ?? HR_PEOPLE.length;
  const avgAtt = sum?.avgAttendance ?? Math.round(HR_PEOPLE.reduce((a, p) => a + p.attendancePct, 0) / HR_PEOPLE.length);
  const orgHeadcount = sum?.headcountByDept?.length ? withColors(sum.headcountByDept) : ORG_HEADCOUNT;
  const genderData = sum?.genderSplit?.length ? withColors(sum.genderSplit) : GENDER_SPLIT;
  const headTotal = orgHeadcount.reduce((a: number, d: any) => a + d.value, 0) || 1;
  const genderTotal = genderData.reduce((a: number, d: any) => a + d.value, 0) || 1;
  const attritionNow = ATTRITION_TREND[ATTRITION_TREND.length - 1];

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <Text style={st.hTitle}>Org Insights</Text>
        <Text style={st.hSub}>{total} employees · all departments</Text>
      </View>

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={st.kpiRow}>
          {[
            { v: `${total}`, l: 'Headcount', c: '#4F46E5', bg: '#EEF2FF' },
            { v: `${avgAtt}%`, l: 'Avg attendance', c: '#10B981', bg: '#ECFDF5' },
            { v: `${attritionNow}%`, l: 'Attrition (Jun)', c: '#F59E0B', bg: '#FFF7ED' },
          ].map((k) => (
            <View key={k.l} style={[st.kpiCard, { backgroundColor: k.bg }]}>
              <Text style={[st.kpiVal, { color: k.c }]}>{k.v}</Text>
              <Text style={st.kpiLabel}>{k.l}</Text>
            </View>
          ))}
        </View>

        {/* attrition trend */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <Text style={st.cardTitle}>Attrition Trend</Text>
            <Text style={st.trendDown}>▼ trending down</Text>
          </View>
          <LineChart values={ATTRITION_TREND} max={10} />
          <View style={st.barLabels}>
            {ATTRITION_LABELS.map((l, i) => (
              <Text key={i} style={[st.barLabel, i === ATTRITION_LABELS.length - 1 && { color: T.primary, fontWeight: '700' }]}>{l}</Text>
            ))}
          </View>
        </View>

        {/* gender split donut */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Gender Diversity</Text>
          <View style={st.donutRow}>
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              <Donut data={genderData} total={genderTotal} />
              <View style={st.donutCenter}>
                <Text style={st.donutCenterNum}>{genderTotal}</Text>
                <Text style={st.donutCenterLabel}>people</Text>
              </View>
            </View>
            <View style={st.legend}>
              {genderData.map((d) => (
                <View key={d.label} style={st.legendRow}>
                  <View style={[st.legendDot, { backgroundColor: d.color }]} />
                  <Text style={st.legendLabel}>{d.label}</Text>
                  <Text style={st.legendVal}>{Math.round((d.value / genderTotal) * 100)}%</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* headcount by department */}
        <View style={[st.card, { marginBottom: 4 }]}>
          <Text style={st.cardTitle}>Headcount by Department</Text>
          {orgHeadcount.map((d) => (
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
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  kpiVal: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 10.5, color: T.sub, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: T.ink, marginBottom: 12 },
  trendDown: { fontSize: 12, fontWeight: '700', color: '#10B981' },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 },
  barLabel: { fontSize: 10.5, color: T.faint, flex: 1, textAlign: 'center' },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutCenterNum: { fontSize: 24, fontWeight: '800', color: T.ink },
  donutCenterLabel: { fontSize: 11, color: T.sub },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 13, color: T.ink },
  legendVal: { fontSize: 13, fontWeight: '700', color: T.ink },
  hcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  hcLabel: { width: 88, fontSize: 12, color: T.sub },
  hcTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  hcFill: { height: 10, borderRadius: 5 },
  hcVal: { width: 18, textAlign: 'right', fontSize: 13, fontWeight: '700', color: T.ink },
});
