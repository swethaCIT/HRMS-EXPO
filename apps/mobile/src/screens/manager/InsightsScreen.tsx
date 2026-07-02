import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Dimensions,
} from 'react-native';
import Svg, { Circle, Rect, G, Line } from 'react-native-svg';
import {
  T, TEAM, ATTENDANCE_TREND, TREND_LABELS, LEAVE_SPLIT, DEPT_HEADCOUNT,
} from '../../data/managerData';
import { analyticsApi } from '../../services/api';

const { width } = Dimensions.get('window');
const PALETTE = ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#0EA5E9'];
const withColors = (arr: { label: string; value: number }[]) =>
  arr.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));

/* ── Donut ── */
function Donut({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const size = 140, stroke = 22, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#F3F4F6" strokeWidth={stroke} fill="none" />
        {data.map((d) => {
          const frac = d.value / total;
          const dash = frac * c;
          const seg = (
            <Circle
              key={d.label}
              cx={size / 2} cy={size / 2} r={r}
              stroke={d.color} strokeWidth={stroke} fill="none"
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return seg;
        })}
      </G>
    </Svg>
  );
}

/* ── Vertical bar chart ── */
function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const w = width - 64, h = 130, pad = 18;
  const max = 100;
  const barW = (w - pad * 2) / values.length * 0.5;
  const gap = (w - pad * 2) / values.length;
  return (
    <Svg width={w} height={h + 24}>
      {[0, 50, 100].map((g) => {
        const y = pad + (h - pad) * (1 - g / max);
        return <Line key={g} x1={0} y1={y} x2={w} y2={y} stroke="#F3F4F6" strokeWidth={1} />;
      })}
      {values.map((v, i) => {
        const barH = (h - pad) * (v / max);
        const x = pad + gap * i + (gap - barW) / 2;
        const y = pad + (h - pad) - barH;
        const today = i === values.length - 1;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={barH} rx={5} fill={today ? T.primary : '#C7D2FE'} />
          </G>
        );
      })}
    </Svg>
  );
}

export default function InsightsScreen() {
  const [sum, setSum] = useState<any>(null);
  useEffect(() => {
    (async () => { try { const { data } = await analyticsApi.summary(); setSum(data); } catch { /* keep mock */ } })();
  }, []);

  const avgAtt = sum?.avgAttendance ?? Math.round(TEAM.reduce((a, m) => a + m.attendancePct, 0) / TEAM.length);
  const avgUtil = Math.round(TEAM.reduce((a, m) => a + m.utilization, 0) / TEAM.length);
  const avgPerf = Math.round(TEAM.reduce((a, m) => a + m.performance, 0) / TEAM.length);
  const attendanceTrend = sum?.attendanceTrend?.length ? sum.attendanceTrend : ATTENDANCE_TREND;
  const trendLabels = sum?.attendanceLabels?.length ? sum.attendanceLabels : TREND_LABELS;
  const leaveSplit = sum?.leaveDistribution?.length ? withColors(sum.leaveDistribution) : LEAVE_SPLIT;
  const deptHeadcount = sum?.headcountByDept?.length ? withColors(sum.headcountByDept) : DEPT_HEADCOUNT;
  const leaveTotal = leaveSplit.reduce((a: number, d: any) => a + d.value, 0) || 1;
  const headTotal = deptHeadcount.reduce((a: number, d: any) => a + d.value, 0) || 1;

  const topPerformers = [...TEAM].sort((a, b) => b.performance - a.performance).slice(0, 3);

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <Text style={st.hTitle}>Team Insights</Text>
        <Text style={st.hSub}>Last 7 days · {TEAM.length} members</Text>
      </View>

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* KPI cards */}
        <View style={st.kpiRow}>
          {[
            { v: `${avgAtt}%`, l: 'Avg attendance', c: '#10B981', bg: '#ECFDF5' },
            { v: `${avgUtil}%`, l: 'Avg utilization', c: '#4F46E5', bg: '#EEF2FF' },
            { v: `${avgPerf}%`, l: 'Avg performance', c: '#F59E0B', bg: '#FFF7ED' },
          ].map((k) => (
            <View key={k.l} style={[st.kpiCard, { backgroundColor: k.bg }]}>
              <Text style={[st.kpiVal, { color: k.c }]}>{k.v}</Text>
              <Text style={st.kpiLabel}>{k.l}</Text>
            </View>
          ))}
        </View>

        {/* Attendance trend */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <Text style={st.cardTitle}>Attendance Trend</Text>
            <Text style={st.trendUp}>▲ {avgAtt}% avg</Text>
          </View>
          <BarChart values={attendanceTrend} labels={trendLabels} />
          <View style={st.barLabels}>
            {trendLabels.map((l: string, i: number) => (
              <Text key={i} style={[st.barLabel, i === trendLabels.length - 1 && { color: T.primary, fontWeight: '700' }]}>{l}</Text>
            ))}
          </View>
        </View>

        {/* Leave split donut */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Leave Distribution</Text>
          <View style={st.donutRow}>
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              <Donut data={leaveSplit} total={leaveTotal} />
              <View style={st.donutCenter}>
                <Text style={st.donutCenterNum}>{leaveTotal}</Text>
                <Text style={st.donutCenterLabel}>days</Text>
              </View>
            </View>
            <View style={st.legend}>
              {leaveSplit.map((d: any) => (
                <View key={d.label} style={st.legendRow}>
                  <View style={[st.legendDot, { backgroundColor: d.color }]} />
                  <Text style={st.legendLabel}>{d.label}</Text>
                  <Text style={st.legendVal}>{d.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Department headcount */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Headcount by Department</Text>
          {deptHeadcount.map((d: any) => (
            <View key={d.label} style={st.hcRow}>
              <Text style={st.hcLabel}>{d.label}</Text>
              <View style={st.hcTrack}>
                <View style={[st.hcFill, { width: `${(d.value / headTotal) * 100}%`, backgroundColor: d.color }]} />
              </View>
              <Text style={st.hcVal}>{d.value}</Text>
            </View>
          ))}
        </View>

        {/* Top performers */}
        <View style={[st.card, { marginBottom: 4 }]}>
          <Text style={st.cardTitle}>Top Performers</Text>
          {topPerformers.map((m, i) => (
            <View key={m.id} style={[st.tpRow, i < topPerformers.length - 1 && st.tpDivider]}>
              <Text style={st.tpRank}>{['🥇', '🥈', '🥉'][i]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.tpName}>{m.name}</Text>
                <Text style={st.tpDesig}>{m.designation}</Text>
              </View>
              <View style={st.tpScore}><Text style={st.tpScoreTx}>{m.performance}</Text></View>
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
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: T.ink, marginBottom: 12 },
  trendUp: { fontSize: 12, fontWeight: '700', color: '#10B981' },

  barLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: -10 },
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

  tpRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  tpDivider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tpRank: { fontSize: 22 },
  tpName: { fontSize: 14, fontWeight: '600', color: T.ink },
  tpDesig: { fontSize: 12, color: T.sub, marginTop: 1 },
  tpScore: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  tpScoreTx: { fontSize: 14, fontWeight: '800', color: T.primary },
});
