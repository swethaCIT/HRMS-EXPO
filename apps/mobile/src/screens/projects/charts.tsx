/* ════════════════════════════════════════════════════════
   Board charts — burndown, velocity, donut and bars.
   Hand-built on react-native-svg to match the chart language already used by
   the manager/HR insight screens (no charting dependency).
   ════════════════════════════════════════════════════════ */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { T } from '../../data/managerData';

const { width } = Dimensions.get('window');
/** Charts sit inside a 16px-padded screen and a 16px-padded card. */
export const CHART_W = width - 64;

const niceMax = (v: number) => {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / pow) * pow;
};

/** Distinct series colours for the multi-team chart. */
export const TEAM_SERIES_COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#7C3AED', '#14B8A6', '#EF4444'];

/**
 * Every team's burndown on one set of axes, plus a faint dashed ideal line and
 * the combined project curve in bold — the "all teams together" comparison.
 */
export function MultiTeamBurndown({
  labels,
  ideal,
  teams,
  combined,
}: {
  labels: string[];
  ideal: number[];
  teams: { teamId: string; name: string; actual: (number | null)[]; total: number }[];
  combined?: (number | null)[];
}) {
  const h = 200;
  const padL = 30;
  const padR = 8;
  const padT = 12;
  const padB = 22;
  const n = Math.max(1, labels.length);

  const everyValue = [
    ...ideal,
    ...teams.flatMap((t) => t.actual.map((v) => v ?? 0)),
    ...(combined ?? []).map((v) => v ?? 0),
    1,
  ];
  const max = niceMax(Math.max(...everyValue));
  const stepX = (CHART_W - padL - padR) / Math.max(1, n - 1);
  const xOf = (i: number) => padL + stepX * i;
  const yOf = (v: number) => padT + (h - padT - padB) * (1 - v / max);

  const pointsOf = (series: (number | null)[]) =>
    series
      .map((v, i) => ({ v, i }))
      .filter((p): p is { v: number; i: number } => p.v !== null)
      .map((p) => `${xOf(p.i)},${yOf(p.v)}`)
      .join(' ');

  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <View>
      <Svg width={CHART_W} height={h}>
        {[0, max / 2, max].map((g, i) => (
          <G key={i}>
            <Line x1={padL} y1={yOf(g)} x2={CHART_W - padR} y2={yOf(g)} stroke="#F3F4F6" strokeWidth={1} />
            <SvgText x={0} y={yOf(g) + 3} fontSize={9} fill={T.faint}>{Math.round(g)}</SvgText>
          </G>
        ))}

        {/* Ideal reference — faint, so the real curves stay dominant */}
        <Polyline
          points={ideal.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')}
          fill="none"
          stroke={T.faint}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />

        {/* Combined project curve, drawn heaviest */}
        {!!combined && (
          <Polyline points={pointsOf(combined)} fill="none" stroke={T.ink} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* One line per team */}
        {teams.map((t, ti) => (
          <Polyline
            key={t.teamId}
            points={pointsOf(t.actual)}
            fill="none"
            stroke={TEAM_SERIES_COLORS[ti % TEAM_SERIES_COLORS.length]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </Svg>

      <View style={ms.xAxis}>
        {labels.map((l, i) => (
          <Text key={i} style={ms.xLabel}>{i % labelEvery === 0 ? l : ''}</Text>
        ))}
      </View>

      <View style={ms.legend}>
        {!!combined && (
          <View style={ms.legendItem}>
            <View style={[ms.legendLine, { backgroundColor: T.ink, height: 3 }]} />
            <Text style={ms.legendTx}>All teams</Text>
          </View>
        )}
        {teams.map((t, ti) => (
          <View key={t.teamId} style={ms.legendItem}>
            <View style={[ms.legendLine, { backgroundColor: TEAM_SERIES_COLORS[ti % TEAM_SERIES_COLORS.length] }]} />
            <Text style={ms.legendTx} numberOfLines={1}>{t.name}</Text>
          </View>
        ))}
        <View style={ms.legendItem}>
          <View style={[ms.legendLine, { backgroundColor: T.faint }]} />
          <Text style={ms.legendTx}>Ideal</Text>
        </View>
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 30, paddingRight: 8, marginTop: -4 },
  xLabel: { fontSize: 8.5, color: T.faint, flex: 1, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 130 },
  legendLine: { width: 14, height: 2.5, borderRadius: 2 },
  legendTx: { fontSize: 11, color: T.sub, flexShrink: 1 },
});

/* ── Sprint burndown: ideal (dashed) vs actual remaining (solid) ── */
export function Burndown({
  labels,
  ideal,
  actual,
  color = T.primary,
}: {
  labels: string[];
  ideal: number[];
  actual: (number | null)[];
  color?: string;
}) {
  const h = 168;
  const padL = 30;
  const padR = 8;
  const padT = 12;
  const padB = 22;
  const n = Math.max(1, labels.length);
  const max = niceMax(Math.max(...ideal, ...actual.map((a) => a ?? 0), 1));
  const stepX = (CHART_W - padL - padR) / Math.max(1, n - 1);
  const xOf = (i: number) => padL + stepX * i;
  const yOf = (v: number) => padT + (h - padT - padB) * (1 - v / max);

  const idealPts = ideal.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  // The actual line stops at today — the future is left blank, not invented.
  const actualIdx = actual.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  const actualPts = actualIdx.map((p) => `${xOf(p.i)},${yOf(p.v)}`).join(' ');
  const areaPts = actualIdx.length
    ? `${xOf(actualIdx[0].i)},${yOf(0)} ${actualPts} ${xOf(actualIdx[actualIdx.length - 1].i)},${yOf(0)}`
    : '';

  // Keep the x-axis readable however long the sprint is.
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <View>
      <Svg width={CHART_W} height={h}>
        {[0, max / 2, max].map((g, i) => (
          <G key={i}>
            <Line x1={padL} y1={yOf(g)} x2={CHART_W - padR} y2={yOf(g)} stroke="#F3F4F6" strokeWidth={1} />
            <SvgText x={padL - 6} y={yOf(g) + 3.5} fontSize={9} fill={T.faint} textAnchor="end">
              {Math.round(g)}
            </SvgText>
          </G>
        ))}

        {/* Ideal trend */}
        <Polyline points={idealPts} fill="none" stroke="#C7D2FE" strokeWidth={2} strokeDasharray="5 4" />

        {/* Actual remaining */}
        {!!areaPts && <Polyline points={areaPts} fill={color} fillOpacity={0.1} stroke="none" />}
        {!!actualPts && (
          <Polyline points={actualPts} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {actualIdx.map((p) => (
          <Circle key={p.i} cx={xOf(p.i)} cy={yOf(p.v)} r={3.2} fill="#FFF" stroke={color} strokeWidth={2} />
        ))}

        {/* Today marker */}
        {actualIdx.length > 0 && actualIdx.length < n && (
          <Line
            x1={xOf(actualIdx[actualIdx.length - 1].i)}
            y1={padT}
            x2={xOf(actualIdx[actualIdx.length - 1].i)}
            y2={h - padB}
            stroke="#E5E7EB"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {labels.map((l, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <SvgText key={i} x={xOf(i)} y={h - 6} fontSize={9} fill={T.faint} textAnchor="middle">
              {l}
            </SvgText>
          ) : null,
        )}
      </Svg>

      <View style={st.legendRow}>
        <View style={st.legendItem}>
          <View style={[st.legendLine, { backgroundColor: color }]} />
          <Text style={st.legendTx}>Remaining</Text>
        </View>
        <View style={st.legendItem}>
          <View style={[st.legendLine, { backgroundColor: '#C7D2FE' }]} />
          <Text style={st.legendTx}>Ideal</Text>
        </View>
      </View>
    </View>
  );
}

/* ── Velocity: committed vs completed per sprint ── */
export function VelocityChart({ data }: { data: { name: string; committed: number; completed: number }[] }) {
  const h = 150;
  const padT = 14;
  const padB = 24;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.committed, d.completed)), 1));
  const slot = CHART_W / Math.max(1, data.length);
  const barW = Math.min(18, slot * 0.28);
  const yOf = (v: number) => padT + (h - padT - padB) * (1 - v / max);

  return (
    <View>
      <Svg width={CHART_W} height={h}>
        {[0, max / 2, max].map((g, i) => (
          <Line key={i} x1={0} y1={yOf(g)} x2={CHART_W} y2={yOf(g)} stroke="#F3F4F6" strokeWidth={1} />
        ))}
        {data.map((d, i) => {
          const cx = slot * i + slot / 2;
          return (
            <G key={i}>
              <Rect x={cx - barW - 2} y={yOf(d.committed)} width={barW} height={Math.max(1, yOf(0) - yOf(d.committed))} rx={4} fill="#C7D2FE" />
              <Rect x={cx + 2} y={yOf(d.completed)} width={barW} height={Math.max(1, yOf(0) - yOf(d.completed))} rx={4} fill={T.primary} />
              <SvgText x={cx} y={h - 8} fontSize={9} fill={T.faint} textAnchor="middle">
                {d.name.replace(/^.*Sprint\s*/i, 'S')}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={st.legendRow}>
        <View style={st.legendItem}>
          <View style={[st.legendSwatch, { backgroundColor: '#C7D2FE' }]} />
          <Text style={st.legendTx}>Committed</Text>
        </View>
        <View style={st.legendItem}>
          <View style={[st.legendSwatch, { backgroundColor: T.primary }]} />
          <Text style={st.legendTx}>Completed</Text>
        </View>
      </View>
    </View>
  );
}

/* ── Simple vertical bars (weekly logged effort) ── */
export function ColumnChart({ values, labels, color = T.primary }: { values: number[]; labels: string[]; color?: string }) {
  const h = 130;
  const padT = 16;
  const padB = 22;
  const max = niceMax(Math.max(...values, 1));
  const slot = CHART_W / Math.max(1, values.length);
  const barW = Math.min(22, slot * 0.5);
  const yOf = (v: number) => padT + (h - padT - padB) * (1 - v / max);

  return (
    <Svg width={CHART_W} height={h}>
      {[0, max / 2, max].map((g, i) => (
        <Line key={i} x1={0} y1={yOf(g)} x2={CHART_W} y2={yOf(g)} stroke="#F3F4F6" strokeWidth={1} />
      ))}
      {values.map((v, i) => {
        const x = slot * i + (slot - barW) / 2;
        const last = i === values.length - 1;
        return (
          <G key={i}>
            <Rect x={x} y={yOf(v)} width={barW} height={Math.max(1, yOf(0) - yOf(v))} rx={4} fill={last ? color : '#C7D2FE'} />
            {v > 0 && (
              <SvgText x={x + barW / 2} y={yOf(v) - 4} fontSize={8.5} fontWeight="700" fill={T.faint} textAnchor="middle">
                {v}
              </SvgText>
            )}
            <SvgText x={x + barW / 2} y={h - 6} fontSize={8.5} fill={T.faint} textAnchor="middle">
              {labels[i]}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/* ── Donut (state / type distribution) ── */
export function Donut({
  data,
  size = 132,
  stroke = 20,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#F3F4F6" strokeWidth={stroke} fill="none" />
        {data.map((d) => {
          const dash = (d.value / total) * c;
          const seg = (
            <Circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={d.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
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

/* ── Thin progress bar used on every card ── */
export function ProgressBar({ pct, color = T.primary, height = 8 }: { pct: number; color?: string; height?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return (
    <View style={[st.track, { height, borderRadius: height / 2 }]}>
      <View style={[st.fill, { width: `${clamped}%`, backgroundColor: color, height, borderRadius: height / 2 }]} />
    </View>
  );
}

/** Segmented bar of work-item states (New/Active/Resolved/Closed). */
export function StateBar({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <View style={st.stack}>
      {total === 0 ? (
        <View style={{ flex: 1, backgroundColor: '#F3F4F6' }} />
      ) : (
        segments.map((s, i) => <View key={i} style={{ flex: s.value || 0.0001, backgroundColor: s.color }} />)
      )}
    </View>
  );
}

const st = StyleSheet.create({
  legendRow: { flexDirection: 'row', gap: 18, marginTop: 8, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 16, height: 3, borderRadius: 2 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendTx: { fontSize: 11, color: T.sub },
  track: { width: '100%', backgroundColor: '#F3F4F6', overflow: 'hidden' },
  fill: {},
  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: '#F3F4F6' },
});
