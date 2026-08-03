import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { projectApi, workItemApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import Icon from '../../components/Icon';
import { ProgressBar } from './charts';
import { ProjectSummary, relativeDays, T } from './boardTheme';

/**
 * "Goals" — the home-screen entry point to the project boards. Shows the live
 * portfolio at a glance plus a horizontal strip of project cards; tapping
 * anything opens the board. Dropped into every role's dashboard.
 */
export default function GoalsSection({ navigation }: { navigation: any }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [mine, setMine] = useState<{ total: number; active: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await projectApi.list();
      if (Array.isArray(data)) setProjects(data as ProjectSummary[]);
    } catch { /* dashboard stays usable offline */ }
    try {
      const { data } = await workItemApi.mine();
      setMine(data?.stats ?? null);
    } catch { /* optional */ }
    setLoaded(true);
  }, []);

  useLivePolling(useCallback(() => { load(); }, [load]));

  // Nothing to show and nothing loaded yet → stay out of the dashboard's way.
  if (loaded && projects.length === 0) {
    return (
      <View style={st.section}>
        <View style={st.head}>
          <Text style={st.headTitle}>GOALS</Text>
          <TouchableOpacity onPress={() => navigation?.navigate('Projects')}>
            <Text style={st.headLink}>Open ›</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={st.emptyCard} activeOpacity={0.85} onPress={() => navigation?.navigate('Projects')}>
          <View style={st.emptyIcon}><Icon name="briefcase" size={18} color={T.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.emptyTitle}>No project boards yet</Text>
            <Text style={st.emptySub}>Epics, sprints and reports live here.</Text>
          </View>
          <Icon name="chevron-right" size={20} color={T.faint} />
        </TouchableOpacity>
      </View>
    );
  }

  const totalItems = projects.reduce((s, p) => s + (p.itemsTotal || 0), 0);
  const totalClosed = projects.reduce((s, p) => s + (p.itemsClosed || 0), 0);
  const activeItems = projects.reduce((s, p) => s + (p.itemsActive || 0), 0);

  return (
    <View style={st.section}>
      <View style={st.head}>
        <Text style={st.headTitle}>GOALS</Text>
        <TouchableOpacity onPress={() => navigation?.navigate('Projects')}>
          <Text style={st.headLink}>See all ›</Text>
        </TouchableOpacity>
      </View>

      {/* Portfolio summary */}
      <TouchableOpacity style={st.summary} activeOpacity={0.85} onPress={() => navigation?.navigate('Projects')}>
        <View style={st.summaryLeft}>
          <Text style={st.summaryPct}>{totalItems ? Math.round((totalClosed / totalItems) * 100) : 0}%</Text>
          <Text style={st.summaryPctLabel}>delivered</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.summaryTitle}>
            {projects.length} project{projects.length === 1 ? '' : 's'} · {activeItems} active item{activeItems === 1 ? '' : 's'}
          </Text>
          <View style={{ marginTop: 8 }}>
            <ProgressBar pct={totalItems ? (totalClosed / totalItems) * 100 : 0} color="#A5B4FC" height={6} />
          </View>
          <Text style={st.summarySub}>
            {mine ? `${mine.active} assigned to you in progress` : `${totalClosed} of ${totalItems} work items closed`}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Project strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
        {projects.slice(0, 6).map((p) => (
          <TouchableOpacity
            key={p.id}
            style={st.projectCard}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('ProjectDetail', { id: p.id, name: p.name })}
          >
            <View style={st.projectTop}>
              <View style={[st.keyChip, { backgroundColor: p.color || T.primary }]}>
                <Text style={st.keyChipTx}>{(p.key || '?').slice(0, 5)}</Text>
              </View>
              <Text style={st.projectPct}>{p.progress}%</Text>
            </View>
            <Text style={st.projectName} numberOfLines={2}>{p.name}</Text>
            <View style={{ marginTop: 8 }}>
              <ProgressBar pct={p.progress} color={p.color || T.primary} height={5} />
            </View>
            <Text style={st.projectMeta} numberOfLines={1}>
              {p.currentSprint ? `Sprint ends ${relativeDays(p.currentSprint.endDate)}` : `${p.itemsTotal} items`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  section: { marginBottom: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headTitle: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.8 },
  headLink: { fontSize: 12, color: T.primary, fontWeight: '600' },

  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: T.headerAlt, borderRadius: 16,
    padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  summaryLeft: { alignItems: 'center', width: 58 },
  summaryPct: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  summaryPctLabel: { fontSize: 9.5, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.5 },
  summaryTitle: { fontSize: 13.5, fontWeight: '700', color: '#FFF' },
  summarySub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 7 },

  projectCard: {
    width: 156, backgroundColor: T.card, borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  projectTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  keyChip: { paddingHorizontal: 8, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  keyChipTx: { color: '#FFF', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },
  projectPct: { fontSize: 13, fontWeight: '800', color: T.ink },
  projectName: { fontSize: 12.5, fontWeight: '700', color: T.ink, marginTop: 9, lineHeight: 17, height: 34 },
  projectMeta: { fontSize: 10, color: T.sub, marginTop: 7 },

  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  emptyIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 13.5, fontWeight: '700', color: T.ink },
  emptySub: { fontSize: 11.5, color: T.sub, marginTop: 2 },
});
