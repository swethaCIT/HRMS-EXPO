import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T } from '../../data/managerData';
import { ACTION_META, ActivityEntry, timeAgo } from './boardTheme';

/**
 * The audit trail, rendered as a timeline: who did what, when, and the exact
 * old → new value for every field that changed. Used for a single work item's
 * History tab and for the project-wide feed.
 */
export default function ActivityFeed({
  entries,
  emptyText = 'Nothing has happened here yet.',
  showEntity = false,
}: {
  entries: ActivityEntry[];
  emptyText?: string;
  /** Show which record each entry belongs to (project-wide feed). */
  showEntity?: boolean;
}) {
  if (!entries?.length) {
    return <Text style={s.empty}>{emptyText}</Text>;
  }

  return (
    <View>
      {entries.map((e, i) => {
        const meta = ACTION_META[e.action] ?? ACTION_META.updated;
        const last = i === entries.length - 1;
        return (
          <View key={e.id} style={s.row}>
            {/* Rail: icon plus the connecting line down to the next entry */}
            <View style={s.rail}>
              <View style={[s.icon, { backgroundColor: meta.bg }]}>
                <Text style={[s.iconTx, { color: meta.fg }]}>{meta.icon}</Text>
              </View>
              {!last && <View style={s.line} />}
            </View>

            <View style={[s.body, !last && s.bodyGap]}>
              <View style={s.topRow}>
                <Text style={s.summary}>{e.summary || `${e.actorName ?? 'Someone'} made a change`}</Text>
                <Text style={s.when}>{timeAgo(e.createdAt)}</Text>
              </View>

              {showEntity && !!e.entityTitle && (
                <Text style={s.entity} numberOfLines={1}>{e.entityTitle}</Text>
              )}

              {!!e.changes?.length && (
                <View style={s.changes}>
                  {e.changes.map((c, ci) => (
                    <View key={`${c.field}-${ci}`} style={s.changeRow}>
                      <Text style={s.field}>{c.field}</Text>
                      <Text style={s.from} numberOfLines={1}>{c.from ?? '—'}</Text>
                      <Text style={s.arrow}>→</Text>
                      <Text style={s.to} numberOfLines={1}>{c.to ?? '—'}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  rail: { alignItems: 'center', width: 30 },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconTx: { fontSize: 12, fontWeight: '800' },
  line: { flex: 1, width: 2, backgroundColor: T.line, marginVertical: 2 },

  body: { flex: 1, paddingTop: 4 },
  bodyGap: { paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  summary: { flex: 1, fontSize: 13, color: T.ink, lineHeight: 18 },
  when: { fontSize: 10.5, color: T.faint, marginTop: 1 },
  entity: { fontSize: 11.5, color: T.primary, fontWeight: '600', marginTop: 2 },

  changes: { marginTop: 6, gap: 4 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  field: { fontSize: 11, fontWeight: '700', color: T.sub, minWidth: 78 },
  from: { fontSize: 11, color: T.faint, textDecorationLine: 'line-through', flexShrink: 1, maxWidth: 90 },
  arrow: { fontSize: 11, color: T.faint },
  to: { fontSize: 11, color: T.ink, fontWeight: '600', flexShrink: 1, maxWidth: 110 },

  empty: { fontSize: 12.5, color: T.faint, textAlign: 'center', paddingVertical: 20 },
});
