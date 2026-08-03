import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { managementKind } from '../../store/slices/authSlice';
import { workItemApi } from '../../services/api';
import { useLivePolling } from '../../utils/useLivePolling';
import { getErrorMessage } from '../../utils/errorMessage';
import Icon from '../../components/Icon';
import { Avatar, BoardHeader, FieldRow, OfflineNote, PriorityChip, StateChip, TypeBadge } from './components';
import { ProgressBar } from './charts';
import {
  ALL_STATES, fmtDate, fmtHours, isOverdue, nextStates, PRIORITY_META, refOf, STATE_META, T, TYPE_META, WorkItemState,
} from './boardTheme';

/** The four workflow states shown as a stepper (Removed is set from the menu). */
const FLOW: WorkItemState[] = ['new', 'active', 'resolved', 'closed'];

/**
 * Work-item detail — the full Azure-style card: state, assignment, effort
 * (original estimate / completed / remaining), hierarchy and time entries.
 */
export default function WorkItemDetailScreen({ route, navigation }: any) {
  const id: string = route?.params?.id;
  const fallbackKey: string | undefined = route?.params?.projectKey;
  const role = useSelector((s: RootState) => s.auth.user?.role);
  const canManage = !!managementKind(role);

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await workItemApi.getOne(id);
      setItem(data);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, [id]);

  useLivePolling(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const changeState = async (state: WorkItemState) => {
    setBusy(true);
    try {
      await workItemApi.setState(id, state);
      await load();
    } catch (err) {
      Alert.alert('Could not update state', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openStateMenu = () => {
    const options = [...nextStates(item.state), ...ALL_STATES.filter((s) => s !== item.state && !nextStates(item.state).includes(s))];
    Alert.alert('Change state', `Currently ${STATE_META[item.state as WorkItemState].label}`, [
      ...options.map((s) => ({ text: STATE_META[s].label, onPress: () => changeState(s) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const openPriorityMenu = () => {
    Alert.alert('Set priority', 'Lower is more urgent', [
      ...[1, 2, 3, 4].map((p) => ({
        text: `P${p}`,
        onPress: async () => {
          setBusy(true);
          try {
            await workItemApi.update(id, { priority: p });
            await load();
          } catch (err) {
            Alert.alert('Could not update priority', getErrorMessage(err));
          } finally {
            setBusy(false);
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const submitLog = async () => {
    const h = Number(hours);
    if (!h || h < 0.25) {
      Alert.alert('Enter hours', 'Log at least 0.25 hours (15 minutes).');
      return;
    }
    setBusy(true);
    try {
      await workItemApi.logWork(id, { hours: h, note: note.trim() || undefined });
      setHours('');
      setNote('');
      setLogOpen(false);
      await load();
    } catch (err) {
      Alert.alert('Could not log work', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete work item', 'Children will be moved up to this item’s parent.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await workItemApi.remove(id);
            navigation?.goBack();
          } catch (err) {
            Alert.alert('Could not delete', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={st.root}>
        <BoardHeader title="Work item" navigation={navigation} />
        <View style={st.center}><ActivityIndicator size="large" color={T.primary} /></View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={st.root}>
        <BoardHeader title="Work item" navigation={navigation} />
        <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {offline && <OfflineNote />}
          <Text style={st.muted}>This work item could not be loaded. Pull down to retry.</Text>
        </ScrollView>
      </View>
    );
  }

  const key = item.projectKey || fallbackKey;
  const meta = TYPE_META[item.type as keyof typeof TYPE_META];
  const stateIdx = FLOW.indexOf(item.state);
  const effortTotal = item.originalEstimate || item.completedWork + item.remainingWork;
  const effortPct = effortTotal ? Math.min(100, Math.round((item.completedWork / effortTotal) * 100)) : 0;

  return (
    <View style={st.root}>
      <BoardHeader
        title={refOf(key, item.seq)}
        subtitle={`${meta.label} · ${item.projectName || ''}`}
        navigation={navigation}
        right={
          canManage && item.allowedChildTypes?.length ? (
            <TouchableOpacity
              style={st.addBtn}
              activeOpacity={0.85}
              onPress={() =>
                navigation?.navigate('CreateWorkItem', {
                  projectId: item.projectId,
                  projectKey: key,
                  parentId: item.id,
                  parentType: item.type,
                  parentTitle: item.title,
                })
              }
            >
              <Text style={st.addBtnTx}>+ Child</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        style={st.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        {offline && <OfflineNote />}

        {/* ── Title card ── */}
        <View style={[st.card, { borderTopWidth: 3, borderTopColor: meta.solid }]}>
          <View style={st.titleTop}>
            <TypeBadge type={item.type} />
            <PriorityChip priority={item.priority} />
            {isOverdue(item) && <View style={st.lateChip}><Text style={st.lateTx}>OVERDUE</Text></View>}
          </View>
          <Text style={st.title}>{item.title}</Text>
          {!!item.description && <Text style={st.desc}>{item.description}</Text>}

          {!!item.parent && (
            <TouchableOpacity
              style={st.parentRow}
              activeOpacity={0.8}
              onPress={() => navigation?.push('WorkItemDetail', { id: item.parent.id, projectKey: key })}
            >
              <Text style={st.parentLabel}>PARENT</Text>
              <Text style={st.parentTx} numberOfLines={1}>
                {TYPE_META[item.parent.type as keyof typeof TYPE_META].label} · {item.parent.title}
              </Text>
              <Icon name="chevron-right" size={16} color={T.faint} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── State stepper ── */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <Text style={st.cardTitle}>STATE</Text>
            <TouchableOpacity onPress={openStateMenu} disabled={busy}>
              <Text style={st.cardAction}>{busy ? 'Saving…' : 'Change'}</Text>
            </TouchableOpacity>
          </View>

          <View style={st.stepper}>
            {FLOW.map((s, i) => {
              const done = stateIdx >= i && stateIdx !== -1;
              const active = stateIdx === i;
              const sm = STATE_META[s];
              return (
                <React.Fragment key={s}>
                  <TouchableOpacity style={st.step} activeOpacity={0.8} onPress={() => changeState(s)} disabled={busy || active}>
                    <View style={[st.stepDot, { backgroundColor: done ? sm.solid : '#E5E7EB', borderColor: active ? sm.solid : 'transparent' }]}>
                      {done && <Text style={st.stepTick}>{active ? '●' : '✓'}</Text>}
                    </View>
                    <Text style={[st.stepLabel, active && { color: sm.fg, fontWeight: '800' }]}>{sm.label}</Text>
                  </TouchableOpacity>
                  {i < FLOW.length - 1 && <View style={[st.stepLine, { backgroundColor: stateIdx > i ? STATE_META[s].solid : '#E5E7EB' }]} />}
                </React.Fragment>
              );
            })}
          </View>

          {item.state === 'removed' && (
            <View style={st.removedNote}><Text style={st.removedTx}>This item is Removed and excluded from every report.</Text></View>
          )}
          {!!item.reason && <Text style={st.reasonTx}>Reason · {item.reason}</Text>}
        </View>

        {/* ── Effort ── */}
        <View style={st.card}>
          <Text style={st.cardTitle}>EFFORT</Text>
          <Text style={st.cardSub}>Original estimate, completed and remaining work</Text>
          <View style={st.effortRow}>
            <View style={st.effortBox}>
              <Text style={st.effortVal}>{fmtHours(item.originalEstimate)}</Text>
              <Text style={st.effortLabel}>Estimate</Text>
            </View>
            <View style={st.effortBox}>
              <Text style={[st.effortVal, { color: '#10B981' }]}>{fmtHours(item.completedWork)}</Text>
              <Text style={st.effortLabel}>Completed</Text>
            </View>
            <View style={st.effortBox}>
              <Text style={[st.effortVal, { color: '#F59E0B' }]}>{fmtHours(item.remainingWork)}</Text>
              <Text style={st.effortLabel}>Remaining</Text>
            </View>
            <View style={st.effortBox}>
              <Text style={[st.effortVal, { color: '#7C3AED' }]}>{item.storyPoints || 0}</Text>
              <Text style={st.effortLabel}>Points</Text>
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            <ProgressBar pct={effortPct} color={meta.solid} />
          </View>
          <Text style={st.effortFoot}>{effortPct}% of estimated effort booked · {fmtHours(item.hoursLogged)} logged in {item.logs?.length ?? 0} entr{(item.logs?.length ?? 0) === 1 ? 'y' : 'ies'}</Text>

          {logOpen ? (
            <View style={st.logForm}>
              <Text style={st.logFormLabel}>Hours</Text>
              <TextInput
                style={st.input}
                value={hours}
                onChangeText={setHours}
                keyboardType="decimal-pad"
                placeholder="e.g. 2.5"
                placeholderTextColor={T.faint}
              />
              <Text style={st.logFormLabel}>Note (optional)</Text>
              <TextInput
                style={[st.input, { height: 64, textAlignVertical: 'top' }]}
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="What did you work on?"
                placeholderTextColor={T.faint}
              />
              <View style={st.logBtnRow}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => setLogOpen(false)} activeOpacity={0.85}>
                  <Text style={st.cancelBtnTx}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.saveBtn} onPress={submitLog} disabled={busy} activeOpacity={0.85}>
                  {busy ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={st.saveBtnTx}>Log work</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={st.logBtn} onPress={() => setLogOpen(true)} activeOpacity={0.85}>
              <Icon name="clock" size={15} color={T.primary} />
              <Text style={st.logBtnTx}>Log work</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Details ── */}
        <View style={st.card}>
          <Text style={st.cardTitle}>DETAILS</Text>
          <View style={{ marginTop: 6 }}>
            <TouchableOpacity style={st.assigneeRow} activeOpacity={0.8} disabled>
              <Text style={st.fieldLabel}>Assigned to</Text>
              <View style={st.assigneeVal}>
                <Avatar name={item.assigneeName} size={24} />
                <Text style={st.assigneeName}>{item.assigneeName || 'Unassigned'}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={openPriorityMenu} activeOpacity={0.8}>
              <FieldRow label="Priority" value={`${PRIORITY_META[item.priority]?.label ?? 'P2'} · tap to change`} />
            </TouchableOpacity>
            <FieldRow label="State" value={STATE_META[item.state as WorkItemState].label} />
            <FieldRow label="Start date" value={fmtDate(item.startDate)} />
            <FieldRow label="Target date" value={fmtDate(item.targetDate)} valueColor={isOverdue(item) ? '#991B1B' : undefined} />
            <FieldRow label="Activated" value={fmtDate(item.activatedAt)} />
            <FieldRow label="Resolved" value={fmtDate(item.resolvedAt)} />
            <FieldRow label="Closed" value={fmtDate(item.closedAt)} />
            <FieldRow label="Created by" value={item.createdByName} />
            <FieldRow label="Created" value={fmtDate(item.createdAt)} />
            {!!item.tags?.length && <FieldRow label="Tags" value={item.tags.join(', ')} />}
          </View>
        </View>

        {/* ── Children ── */}
        {!!item.children?.length && (
          <View style={st.card}>
            <Text style={st.cardTitle}>CHILD ITEMS · {item.children.length}</Text>
            <View style={{ marginTop: 8 }}>
              {item.children.map((c: any, i: number) => (
                <TouchableOpacity
                  key={c.id}
                  style={[st.childRow, i < item.children.length - 1 && st.divider]}
                  activeOpacity={0.8}
                  onPress={() => navigation?.push('WorkItemDetail', { id: c.id, projectKey: key })}
                >
                  <TypeBadge type={c.type} compact />
                  <View style={{ flex: 1 }}>
                    <Text style={st.childTitle} numberOfLines={1}>{c.title}</Text>
                    <Text style={st.childSub}>
                      {refOf(key, c.seq)} · {c.assigneeName || 'Unassigned'} · {fmtHours(c.remainingWork)} left
                    </Text>
                  </View>
                  <StateChip state={c.state} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Time entries ── */}
        {!!item.logs?.length && (
          <View style={st.card}>
            <Text style={st.cardTitle}>TIME ENTRIES</Text>
            <Text style={st.cardSub}>{fmtHours(item.hoursLogged)} logged in total</Text>
            {item.logs.map((l: any, i: number) => (
              <View key={l.id} style={[st.logRow, i < item.logs.length - 1 && st.divider]}>
                <Avatar name={l.employeeName} size={26} />
                <View style={{ flex: 1 }}>
                  <Text style={st.logWho}>{l.employeeName || 'Team member'}</Text>
                  <Text style={st.logNote} numberOfLines={2}>{l.note || 'No note'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.logHours}>{fmtHours(l.hours)}</Text>
                  <Text style={st.logDate}>{fmtDate(l.date)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {canManage && (
          <TouchableOpacity style={st.deleteBtn} onPress={onDelete} activeOpacity={0.85}>
            <Text style={st.deleteTx}>Delete work item</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 13, color: T.sub },

  addBtn: { backgroundColor: T.primary, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 },
  addBtnTx: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  card: {
    backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 12, fontWeight: '800', color: T.ink, letterSpacing: 0.8 },
  cardSub: { fontSize: 11.5, color: T.faint, marginTop: 2, marginBottom: 8 },
  cardAction: { fontSize: 12, fontWeight: '700', color: T.primary },

  titleTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 17, fontWeight: '800', color: T.ink, marginTop: 10, lineHeight: 24 },
  desc: { fontSize: 13, color: T.sub, marginTop: 8, lineHeight: 20 },
  lateChip: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3.5 },
  lateTx: { fontSize: 10, fontWeight: '800', color: '#991B1B' },

  parentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  parentLabel: { fontSize: 9.5, fontWeight: '800', color: T.faint, letterSpacing: 0.8 },
  parentTx: { flex: 1, fontSize: 12.5, fontWeight: '600', color: T.primary },

  stepper: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  step: { alignItems: 'center', width: 62 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  stepTick: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  stepLabel: { fontSize: 10.5, color: T.sub, marginTop: 5, fontWeight: '600' },
  stepLine: { flex: 1, height: 2, marginBottom: 18 },
  removedNote: { marginTop: 12, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10 },
  removedTx: { fontSize: 11.5, color: T.sub },
  reasonTx: { fontSize: 11.5, color: T.sub, marginTop: 12 },

  effortRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  effortBox: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  effortVal: { fontSize: 15.5, fontWeight: '800', color: T.ink },
  effortLabel: { fontSize: 10, color: T.sub, marginTop: 2 },
  effortFoot: { fontSize: 11, color: T.sub, marginTop: 8 },

  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14,
    backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 11,
  },
  logBtnTx: { fontSize: 13, fontWeight: '700', color: T.primary },
  logForm: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  logFormLabel: { fontSize: 11, fontWeight: '700', color: T.sub, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: T.ink, backgroundColor: '#FFF', marginBottom: 12,
  },
  logBtnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#F3F4F6' },
  cancelBtnTx: { fontSize: 13, fontWeight: '700', color: T.sub },
  saveBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: T.primary, minHeight: 42, justifyContent: 'center' },
  saveBtnTx: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  assigneeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  fieldLabel: { width: 118, fontSize: 12, color: T.sub },
  assigneeVal: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  assigneeName: { fontSize: 13, fontWeight: '600', color: T.ink },

  childRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  childTitle: { fontSize: 13, fontWeight: '700', color: T.ink },
  childSub: { fontSize: 10.5, color: T.sub, marginTop: 2 },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  logWho: { fontSize: 12.5, fontWeight: '700', color: T.ink },
  logNote: { fontSize: 11, color: T.sub, marginTop: 2 },
  logHours: { fontSize: 13, fontWeight: '800', color: T.primary },
  logDate: { fontSize: 10.5, color: T.faint, marginTop: 2 },

  deleteBtn: { alignItems: 'center', paddingVertical: 14 },
  deleteTx: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
});
