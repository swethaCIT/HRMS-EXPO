import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Dimensions, RefreshControl,
} from 'react-native';
import Svg, { Circle, Rect, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
import {
  T, TEAM, ATTENDANCE_TREND, TREND_LABELS, LEAVE_SPLIT, DEPT_HEADCOUNT,
} from '../../data/managerData';
import { analyticsApi } from '../../services/api';

const { width } = Dimensions.get('window');
const PALETTE = ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#0EA5E9'];
const withColors = (arr: { label: string; value: number }[]) =>
  arr.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
/* Parse "09:02 AM" → minutes since midnight (null when absent). */
const toMinutes = (t?: string): number | null => {
  if (!t) return null;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = (+m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + (+m[2]);
};

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
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return seg;
        })}
      </G>
    </Svg>
  );
}

/* ── Vertical bar chart (values shown on top) ── */
function BarChart({ values, color = T.primary }: { values: number[]; color?: string }) {
  const w = width - 64, h = 130, pad = 22;
  const max = 100;
  const barW = (w - pad * 2) / values.length * 0.52;
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
            <Rect x={x} y={y} width={barW} height={barH} rx={5} fill={today ? color : '#C7D2FE'} />
            <SvgText x={x + barW / 2} y={y - 6} fontSize={9.5} fontWeight="700" fill={T.faint} textAnchor="middle">{v}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/* ── Line / area chart ── */
function LineChart({ values, max, color, fill }: { values: number[]; max: number; color: string; fill?: boolean }) {
  const w = width - 64, h = 132, pad = 16;
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
      {fill && <Polyline points={areaPts} fill={color} fillOpacity={0.1} stroke="none" />}
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <Circle key={i} cx={pad + stepX * i} cy={yOf(v)} r={4} fill="#FFF" stroke={color} strokeWidth={2.5} />
      ))}
    </Svg>
  );
}

/* Small ▲/▼ delta pill */
function Delta({ value, suffix = '%', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  const up = value >= 0;
  const good = invert ? !up : up;
  const color = value === 0 ? T.faint : good ? '#10B981' : '#EF4444';
  return (
    <Text style={[st.delta, { color }]}>
      {value === 0 ? '▬' : up ? '▲' : '▼'} {Math.abs(value)}{suffix}
    </Text>
  );
}

export default function InsightsScreen() {
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
  const avgAtt = sum?.avgAttendance ?? Math.round(mean(TEAM.map((m) => m.attendancePct)));
  const avgUtil = Math.round(mean(TEAM.map((m) => m.utilization)));
  const avgPerf = Math.round(mean(TEAM.map((m) => m.performance)));

  const attendanceTrend: number[] = sum?.attendanceTrend?.length ? sum.attendanceTrend : ATTENDANCE_TREND;
  const trendLabels: string[] = sum?.attendanceLabels?.length ? sum.attendanceLabels : TREND_LABELS;
  const leaveSplit = sum?.leaveDistribution?.length ? withColors(sum.leaveDistribution) : LEAVE_SPLIT;
  const deptHeadcount = sum?.headcountByDept?.length ? withColors(sum.headcountByDept) : DEPT_HEADCOUNT;
  const leaveTotal = leaveSplit.reduce((a: number, d: any) => a + d.value, 0) || 1;
  const headTotal = deptHeadcount.reduce((a: number, d: any) => a + d.value, 0) || 1;

  /* Week-over-week attendance delta (2nd half vs 1st half of the trend). */
  const halfAt = Math.floor(attendanceTrend.length / 2) || 1;
  const prevWk = Math.round(mean(attendanceTrend.slice(0, halfAt)));
  const thisWk = Math.round(mean(attendanceTrend.slice(halfAt)));
  const attDelta = thisWk - prevWk;

  /* Utilization/productivity trend derived from the attendance shape × avg utilization. */
  const utilTrend = attendanceTrend.map((v) => clamp(Math.round(v * (avgUtil / 100))));

  /* Today's presence breakdown from the team roster. */
  const present = TEAM.filter((m) => m.presence === 'in' || m.presence === 'remote').length;
  const onLeave = TEAM.filter((m) => m.presence === 'leave').length;
  const absent = TEAM.filter((m) => m.presence === 'out').length;

  /* On-time % = present members who punched in by 09:15. */
  const punchedIn = TEAM.filter((m) => toMinutes(m.checkIn) != null);
  const onTime = punchedIn.filter((m) => (toMinutes(m.checkIn) as number) <= 9 * 60 + 15).length;
  const onTimePct = punchedIn.length ? Math.round((onTime / punchedIn.length) * 100) : 0;

  const avgHours = (avgAtt / 100 * 9).toFixed(1);
  const pendingCount = TEAM.reduce((a, m) => a + m.pending, 0);

  const teamAttendance = [...TEAM].sort((a, b) => b.attendancePct - a.attendancePct);
  const topPerformers = [...TEAM].sort((a, b) => b.performance - a.performance).slice(0, 3);

  const miniStats = [
    { v: `${avgHours}`, l: 'Avg hrs / day', c: T.primary },
    { v: `${onTimePct}%`, l: 'On-time rate', c: '#10B981' },
    { v: `${present}/${TEAM.length}`, l: 'Present today', c: '#0EA5E9' },
    { v: `${pendingCount}`, l: 'Pending approvals', c: '#F59E0B' },
  ];

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <Text style={st.hTitle}>Team Insights</Text>
        <Text style={st.hSub}>Last 7 days · {TEAM.length} members</Text>
      </View>

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {/* KPI cards with WoW delta */}
        <View style={st.kpiRow}>
          {[
            { v: `${avgAtt}%`, l: 'Avg attendance', c: '#10B981', bg: '#ECFDF5', d: attDelta },
            { v: `${avgUtil}%`, l: 'Avg utilization', c: '#4F46E5', bg: '#EEF2FF', d: 3 },
            { v: `${avgPerf}%`, l: 'Avg performance', c: '#F59E0B', bg: '#FFF7ED', d: 2 },
          ].map((k) => (
            <View key={k.l} style={[st.kpiCard, { backgroundColor: k.bg }]}>
              <Text style={[st.kpiVal, { color: k.c }]}>{k.v}</Text>
              <Text style={st.kpiLabel}>{k.l}</Text>
              <Delta value={k.d} />
            </View>
          ))}
        </View>

        {/* Quick-stat grid */}
        <View style={st.statGrid}>
          {miniStats.map((s) => (
            <View key={s.l} style={st.statTile}>
              <Text style={[st.statVal, { color: s.c }]}>{s.v}</Text>
              <Text style={st.statLabel}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Attendance trend */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>ATTENDANCE TREND</Text>
              <Text style={st.cardSub}>Daily presence rate · this week vs last</Text>
            </View>
            <Delta value={attDelta} />
          </View>
          <BarChart values={attendanceTrend} color={T.primary} />
          <View style={st.barLabels}>
            {trendLabels.map((l: string, i: number) => (
              <Text key={i} style={[st.barLabel, i === trendLabels.length - 1 && { color: T.primary, fontWeight: '700' }]}>{l}</Text>
            ))}
          </View>
          <View style={st.footNote}>
            <Text style={st.footTx}>This week <Text style={st.footStrong}>{thisWk}%</Text></Text>
            <Text style={st.footTx}>Last week <Text style={st.footStrong}>{prevWk}%</Text></Text>
          </View>
        </View>

        {/* Today's attendance breakdown */}
        <View style={st.card}>
          <Text style={st.cardTitle}>TODAY'S ATTENDANCE</Text>
          <Text style={st.cardSub}>Live presence across the team</Text>
          <View style={st.stackBar}>
            <View style={{ flex: present || 0.001, backgroundColor: '#10B981' }} />
            <View style={{ flex: onLeave || 0.001, backgroundColor: '#F59E0B' }} />
            <View style={{ flex: absent || 0.001, backgroundColor: '#E5E7EB' }} />
          </View>
          <View style={st.breakRow}>
            {[
              { l: 'Present', v: present, c: '#10B981' },
              { l: 'On leave', v: onLeave, c: '#F59E0B' },
              { l: 'Absent', v: absent, c: '#9CA3AF' },
            ].map((b) => (
              <View key={b.l} style={st.breakItem}>
                <View style={st.breakTop}>
                  <View style={[st.legendDot, { backgroundColor: b.c }]} />
                  <Text style={st.breakVal}>{b.v}</Text>
                </View>
                <Text style={st.breakLabel}>{b.l}</Text>
                <Text style={st.breakPct}>{Math.round((b.v / TEAM.length) * 100)}%</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Productivity / utilization trend */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>PRODUCTIVITY TREND</Text>
              <Text style={st.cardSub}>Billable utilization · rolling 7 days</Text>
            </View>
            <Text style={[st.trendUp, { color: T.primary }]}>{avgUtil}% avg</Text>
          </View>
          <LineChart values={utilTrend} max={100} color={T.primary} fill />
          <View style={st.barLabels}>
            {trendLabels.map((l: string, i: number) => (
              <Text key={i} style={st.barLabel}>{l}</Text>
            ))}
          </View>
        </View>

        {/* Leave split donut */}
        <View style={st.card}>
          <Text style={st.cardTitle}>LEAVE DISTRIBUTION</Text>
          <Text style={st.cardSub}>Approved days by leave type</Text>
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
                  <Text style={st.legendPct}>{Math.round((d.value / leaveTotal) * 100)}%</Text>
                  <Text style={st.legendVal}>{d.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Department headcount */}
        <View style={st.card}>
          <Text style={st.cardTitle}>HEADCOUNT BY DEPARTMENT</Text>
          <Text style={st.cardSub}>Team size across functions</Text>
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

        {/* Per-member attendance */}
        <View style={st.card}>
          <Text style={st.cardTitle}>TEAM ATTENDANCE</Text>
          <Text style={st.cardSub}>30-day presence rate per member</Text>
          {teamAttendance.map((m) => {
            const c = m.attendancePct >= 95 ? '#10B981' : m.attendancePct >= 88 ? T.primary : '#F59E0B';
            return (
              <View key={m.id} style={st.memRow}>
                <Text style={st.memName} numberOfLines={1}>{m.name}</Text>
                <View style={st.hcTrack}>
                  <View style={[st.hcFill, { width: `${m.attendancePct}%`, backgroundColor: c }]} />
                </View>
                <Text style={[st.memPct, { color: c }]}>{m.attendancePct}%</Text>
              </View>
            );
          })}
        </View>

        {/* Top performers */}
        <View style={[st.card, { marginBottom: 4 }]}>
          <Text style={st.cardTitle}>TOP PERFORMERS</Text>
          <Text style={st.cardSub}>Highest last-review scores</Text>
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
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  kpiCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  kpiVal: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 10.5, color: T.sub, marginTop: 4, textAlign: 'center' },
  delta: { fontSize: 11, fontWeight: '700', marginTop: 4 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statTile: {
    width: (width - 32 - 10) / 2, backgroundColor: T.card, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  statVal: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11.5, color: T.sub, marginTop: 3 },

  card: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.8 },
  cardSub: { fontSize: 11.5, color: T.faint, marginTop: 2, marginBottom: 12 },
  trendUp: { fontSize: 12, fontWeight: '700', color: '#10B981' },

  barLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: -6 },
  barLabel: { fontSize: 10.5, color: T.faint, flex: 1, textAlign: 'center' },
  footNote: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  footTx: { fontSize: 12, color: T.sub },
  footStrong: { fontWeight: '800', color: T.ink },

  stackBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: '#F3F4F6', marginBottom: 14 },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakItem: { flex: 1, alignItems: 'center' },
  breakTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breakVal: { fontSize: 20, fontWeight: '800', color: T.ink },
  breakLabel: { fontSize: 12, color: T.sub, marginTop: 2 },
  breakPct: { fontSize: 11, color: T.faint, marginTop: 1 },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutCenterNum: { fontSize: 24, fontWeight: '800', color: T.ink },
  donutCenterLabel: { fontSize: 11, color: T.sub },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 13, color: T.ink },
  legendPct: { fontSize: 12, color: T.sub, width: 38, textAlign: 'right' },
  legendVal: { fontSize: 13, fontWeight: '700', color: T.ink, width: 24, textAlign: 'right' },

  hcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  hcLabel: { width: 88, fontSize: 12, color: T.sub },
  hcTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  hcFill: { height: 10, borderRadius: 5 },
  hcVal: { width: 18, textAlign: 'right', fontSize: 13, fontWeight: '700', color: T.ink },

  memRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  memName: { width: 96, fontSize: 12.5, color: T.ink },
  memPct: { width: 40, textAlign: 'right', fontSize: 13, fontWeight: '800' },

  tpRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  tpDivider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tpRank: { fontSize: 22 },
  tpName: { fontSize: 14, fontWeight: '600', color: T.ink },
  tpDesig: { fontSize: 12, color: T.sub, marginTop: 1 },
  tpScore: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  tpScoreTx: { fontSize: 14, fontWeight: '800', color: T.primary },
});
