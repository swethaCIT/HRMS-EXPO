import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import {
  PRIORITIES, STATUS_STYLE, APPROVAL_STYLE, buildTracker, Ticket,
} from '../../data/ticketTaxonomy';
import { ticketApi } from '../../services/api';

const DEPT_ICON: Record<string, string> = { HR: '🧑‍💼', IT: '💻', Admin: '🗂️', Others: '❓' };

/* Neutral/gray chip for cancelled (and any status not in STATUS_STYLE). */
const NEUTRAL_STATUS = { color: '#6B7280', bg: '#F3F4F6' };
function statusStyleOf(status: string): { color: string; bg: string } {
  return (STATUS_STYLE as Record<string, { color: string; bg: string }>)[status] ?? NEUTRAL_STATUS;
}

export default function TicketDetailScreen({ navigation, route }: any) {
  const ticket: Ticket | undefined = route?.params?.ticket;
  const [withdrawing, setWithdrawing] = useState(false);

  /* employee self-service: withdraw a ticket that is still open / pending approval */
  function handleWithdraw() {
    if (!ticket) return;
    Alert.alert('Withdraw Ticket', 'Withdraw this ticket? This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          setWithdrawing(true);
          try { await ticketApi.cancel(ticket.id); } catch { /* offline: still leave the screen */ }
          setWithdrawing(false);
          navigation?.goBack();
        },
      },
    ]);
  }

  if (!ticket) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#6B7280' }}>Ticket not found</Text>
      </View>
    );
  }

  const st      = statusStyleOf(ticket.status);
  const ap      = APPROVAL_STYLE[ticket.approval];
  const pri     = PRIORITIES.find(p => p.key === ticket.priority)!;
  const tracker = buildTracker(ticket);
  const canWithdraw = ticket.status === 'Open' || ticket.approval === 'Pending';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => navigation?.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerId}>{ticket.id}</Text>
          <Text style={s.headerDept}>{DEPT_ICON[ticket.dept]} {ticket.dept} Ticket</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[s.statusText, { color: st.color }]}>{ticket.status}</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Subject + approval ── */}
        <View style={s.card}>
          <Text style={s.subject}>{ticket.subject}</Text>
          <Text style={s.path}>{ticket.category} › {ticket.subCategory}</Text>

          <View style={[s.approvalBanner, { backgroundColor: ap.bg }]}>
            <Text style={[s.approvalIcon, { color: ap.color }]}>{ap.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.approvalTitle, { color: ap.color }]}>
                {ticket.approval === 'Pending'  ? 'Pending Approval'
                  : ticket.approval === 'Approved' ? 'Approved'
                  : 'Rejected'}
              </Text>
              <Text style={s.approvalDesc}>
                {ticket.approval === 'Pending'
                  ? 'Your request is waiting for manager approval.'
                  : ticket.approval === 'Approved'
                  ? `Approved and ${ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'resolved' : 'being worked on'}.`
                  : 'This request was not approved. See the reason below.'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Status tracker ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>STATUS</Text>
          <View style={s.tracker}>
            {tracker.map((stage, i) => {
              const last = i === tracker.length - 1;
              const dotColor = stage.rejected ? '#EF4444'
                : stage.done ? '#10B981'
                : stage.current ? '#F59E0B'
                : '#D1D5DB';
              return (
                <View key={stage.label} style={s.stageRow}>
                  <View style={s.stageLeft}>
                    <View style={[s.stageDot, { backgroundColor: dotColor, borderColor: dotColor }]}>
                      {stage.done && !stage.rejected && <Text style={s.stageDotTick}>✓</Text>}
                      {stage.rejected && <Text style={s.stageDotTick}>✕</Text>}
                      {stage.current && !stage.done && !stage.rejected && <View style={s.stagePulse} />}
                    </View>
                    {!last && <View style={[s.stageLine, { backgroundColor: stage.done ? '#10B981' : '#E5E7EB' }]} />}
                  </View>
                  <View style={s.stageBody}>
                    <Text style={[
                      s.stageLabel,
                      (stage.done || stage.current) && { color: '#1F2937', fontWeight: '700' },
                      stage.rejected && { color: '#991B1B' },
                    ]}>
                      {stage.label}
                    </Text>
                    {stage.current && !stage.done && <Text style={s.stageNow}>Current stage</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Details grid ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>DETAILS</Text>
          <View style={s.kvRow}>
            <Text style={s.kvKey}>Department</Text>
            <Text style={s.kvVal}>{DEPT_ICON[ticket.dept]} {ticket.dept}</Text>
          </View>
          <View style={s.kvRow}>
            <Text style={s.kvKey}>Category</Text>
            <Text style={s.kvVal}>{ticket.category}</Text>
          </View>
          <View style={s.kvRow}>
            <Text style={s.kvKey}>Sub Category</Text>
            <Text style={s.kvVal}>{ticket.subCategory}</Text>
          </View>
          <View style={s.kvRow}>
            <Text style={s.kvKey}>Priority</Text>
            <View style={[s.priChip, { backgroundColor: pri.bg }]}>
              <View style={[s.priDot, { backgroundColor: pri.color }]} />
              <Text style={[s.priText, { color: pri.color }]}>{ticket.priority}</Text>
            </View>
          </View>
          <View style={s.kvRow}>
            <Text style={s.kvKey}>Raised On</Text>
            <Text style={s.kvVal}>{ticket.createdAt}</Text>
          </View>
          {ticket.agent && (
            <View style={[s.kvRow, { borderBottomWidth: 0 }]}>
              <Text style={s.kvKey}>Assigned To</Text>
              <Text style={s.kvVal}>{ticket.agent}</Text>
            </View>
          )}
        </View>

        {/* ── Description ── */}
        {ticket.description ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>DESCRIPTION</Text>
            <Text style={s.descText}>{ticket.description}</Text>
          </View>
        ) : null}

        {/* ── Activity timeline ── */}
        {ticket.timeline && ticket.timeline.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>ACTIVITY</Text>
            <View style={{ marginTop: 8 }}>
              {ticket.timeline.map((ev, i) => {
                const last    = i === ticket.timeline!.length - 1;
                const pending = ev.at === null;
                return (
                  <View key={i} style={s.evRow}>
                    <View style={s.evLeft}>
                      <View style={[s.evDot, pending && s.evDotPending]} />
                      {!last && <View style={s.evLine} />}
                    </View>
                    <View style={s.evBody}>
                      <Text style={[s.evLabel, pending && { color: '#9CA3AF' }]}>{ev.label}</Text>
                      <Text style={s.evMeta}>
                        {ev.at ?? 'Pending'}{ev.by ? ` · ${ev.by}` : ''}
                      </Text>
                      {ev.note ? <Text style={s.evNote}>{ev.note}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Notify list ── */}
        {ticket.notify && ticket.notify.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>NOTIFYING</Text>
            <View style={s.notifyWrap}>
              {ticket.notify.map(name => (
                <View key={name} style={s.notifyChip}>
                  <View style={s.chipAvatar}>
                    <Text style={s.chipAvatarText}>
                      {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={s.chipName}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Withdraw ── */}
        {canWithdraw && (
          <TouchableOpacity
            style={[s.withdrawBtn, withdrawing && s.withdrawBtnDisabled]}
            onPress={handleWithdraw}
            disabled={withdrawing}
            activeOpacity={0.85}
          >
            <Text style={s.withdrawText}>{withdrawing ? 'Withdrawing…' : 'Withdraw ticket'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

/* ════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  /* header */
  header: {
    backgroundColor: '#1E1B4B',
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  iconBtn:   { width: 32, alignItems: 'flex-start' },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerId:   { fontSize: 17, fontWeight: '700', color: '#FFF' },
  headerDept: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statusBadge:{ borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '700' },

  scroll: { flex: 1 },

  card: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },

  subject: { fontSize: 17, fontWeight: '800', color: '#1F2937', lineHeight: 23, marginTop: 4 },
  path:    { fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 14 },

  /* approval banner */
  approvalBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14 },
  approvalIcon:   { fontSize: 22, fontWeight: '800' },
  approvalTitle:  { fontSize: 15, fontWeight: '800' },
  approvalDesc:   { fontSize: 12, color: '#6B7280', marginTop: 2 },

  /* status tracker */
  tracker: { marginTop: 14 },
  stageRow: { flexDirection: 'row' },
  stageLeft: { width: 28, alignItems: 'center' },
  stageDot: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  stageDotTick: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  stagePulse:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  stageLine:    { width: 2, flex: 1, marginVertical: 2 },
  stageBody:    { flex: 1, paddingBottom: 18, paddingLeft: 10, paddingTop: 1 },
  stageLabel:   { fontSize: 14, color: '#9CA3AF' },
  stageNow:     { fontSize: 11, color: '#B45309', fontWeight: '600', marginTop: 2 },

  /* key-value */
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  kvKey: { fontSize: 13, color: '#6B7280' },
  kvVal: { fontSize: 14, color: '#1F2937', fontWeight: '600' },

  priChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  priDot:  { width: 7, height: 7, borderRadius: 4 },
  priText: { fontSize: 11, fontWeight: '700' },

  descText: { fontSize: 14, color: '#374151', lineHeight: 21, marginTop: 10 },

  /* activity */
  evRow:  { flexDirection: 'row' },
  evLeft: { width: 20, alignItems: 'center' },
  evDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4F46E5', marginTop: 3 },
  evDotPending: { backgroundColor: '#D1D5DB' },
  evLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 2 },
  evBody: { flex: 1, paddingBottom: 16, paddingLeft: 10 },
  evLabel:{ fontSize: 14, color: '#1F2937', fontWeight: '600' },
  evMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  evNote: { fontSize: 12, color: '#6B7280', marginTop: 4, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, lineHeight: 17 },

  /* notify */
  notifyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  notifyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: '#C7D2FE' },
  chipAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  chipName: { fontSize: 12, color: '#3730A3', fontWeight: '600' },

  /* withdraw */
  withdrawBtn: {
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 12, paddingVertical: 15, alignItems: 'center',
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5',
  },
  withdrawBtnDisabled: { opacity: 0.6 },
  withdrawText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
});
