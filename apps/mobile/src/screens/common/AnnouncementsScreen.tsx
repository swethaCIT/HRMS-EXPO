import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { T } from '../../data/managerData';
import { announcementApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';
import Icon from '../../components/Icon';

/* ── Types ── */
interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  authorName: string;
  pinned: boolean;
  createdAt: string;
}

/* ── Category tint palette (stable colour per category) ── */
const CATEGORY_TINTS = [
  { bg: '#EEF2FF', fg: T.primary },
  { bg: T.amber.bg, fg: T.amber.fg },
  { bg: T.green.bg, fg: T.green.fg },
  { bg: T.blue.bg, fg: T.blue.fg },
  { bg: T.purple.bg, fg: T.purple.fg },
  { bg: T.red.bg, fg: T.red.fg },
];
function categoryTint(cat: string) {
  const s = cat || 'General';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CATEGORY_TINTS[h % CATEGORY_TINTS.length];
}

/** Human relative time from an ISO timestamp. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CATEGORIES = ['General', 'HR', 'IT', 'Event', 'Policy', 'Urgent'];

export default function AnnouncementsScreen({ navigation }: any) {
  const user = useSelector((s: RootState) => s.auth.user);
  const canPost = user?.role === 'hr' || user?.role === 'admin';

  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', category: 'General' });
  const setF = (k: keyof typeof draft, v: string) => setDraft((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const { data } = await announcementApi.list();
      if (Array.isArray(data)) setItems(data as Announcement[]);
    } catch { /* keep whatever we have */ }
  }, []);

  useEffect(() => {
    (async () => { await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // pinned first, then newest first
  const ordered = useMemo(() => {
    return [...items].sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items]);

  const submit = async () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      return Alert.alert('Missing details', 'Add a title and a message before posting.');
    }
    setPosting(true);
    try {
      await announcementApi.create({ title: draft.title.trim(), body: draft.body.trim(), category: draft.category });
      setComposeOpen(false);
      setDraft({ title: '', body: '', category: 'General' });
      await load();
    } catch (e: any) {
      Alert.alert('Could not post', getErrorMessage(e, 'Please try again.'));
    } finally { setPosting(false); }
  };

  const confirmDelete = (a: Announcement) => {
    Alert.alert('Delete announcement', `Remove “${a.title}”? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await announcementApi.remove(a.id); await load(); }
          catch (e: any) { Alert.alert('Could not delete', getErrorMessage(e, 'Please try again.')); }
        },
      },
    ]);
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />

      {/* ── Header ── */}
      <View style={st.header}>
        <TouchableOpacity
          style={st.iconBtn}
          onPress={() => navigation?.canGoBack?.() && navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={st.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Announcements</Text>
        <View style={st.iconBtn} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={T.primary} size="large" /></View>
      ) : (
        <ScrollView
          style={st.body}
          contentContainerStyle={{ padding: 16, paddingBottom: canPost ? 96 : 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
        >
          {ordered.length === 0 ? (
            <View style={st.empty}>
              <Icon name="bell" size={40} color={T.faint} />
              <Text style={st.emptyTx}>No announcements yet</Text>
              <Text style={st.emptySub}>
                {canPost ? 'Tap “Post” to share the first update with your team.' : 'Company updates will show up here.'}
              </Text>
            </View>
          ) : (
            ordered.map((a) => {
              const tint = categoryTint(a.category);
              return (
                <TouchableOpacity
                  key={a.id}
                  activeOpacity={canPost ? 0.85 : 1}
                  onLongPress={canPost ? () => confirmDelete(a) : undefined}
                  style={[st.card, a.pinned && st.cardPinned]}
                >
                  <View style={st.cardTop}>
                    <View style={[st.catChip, { backgroundColor: tint.bg }]}>
                      <Text style={[st.catChipTx, { color: tint.fg }]}>{a.category || 'General'}</Text>
                    </View>
                    <View style={st.cardTopRight}>
                      {a.pinned && <Text style={st.pin}>📌</Text>}
                      {canPost && (
                        <TouchableOpacity
                          onPress={() => confirmDelete(a)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={st.trash}>🗑</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <Text style={st.title}>{a.title}</Text>
                  <Text style={st.bodyTx}>{a.body}</Text>

                  <View style={st.metaRow}>
                    <View style={[st.authorDot]}><Text style={st.authorDotTx}>{(a.authorName || '?').charAt(0).toUpperCase()}</Text></View>
                    <Text style={st.author}>{a.authorName || 'HR Team'}</Text>
                    <Text style={st.metaSep}>·</Text>
                    <Text style={st.time}>{relativeTime(a.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Floating post button (HR/admin) ── */}
      {canPost && !loading && (
        <TouchableOpacity style={st.fab} activeOpacity={0.9} onPress={() => setComposeOpen(true)}>
          <Text style={st.fabTx}>＋ Post</Text>
        </TouchableOpacity>
      )}

      {/* ── Compose modal ── */}
      <Modal visible={composeOpen} transparent animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <View style={st.mOverlay}>
          <View style={st.mSheet}>
            <View style={st.mHandle} />
            <Text style={st.mTitle}>New announcement</Text>
            <Text style={st.mSub}>Share an update with everyone in the company.</Text>

            <TextInput
              style={st.mInput}
              placeholder="Title"
              placeholderTextColor="#9CA3AF"
              value={draft.title}
              onChangeText={(v) => setF('title', v)}
            />
            <TextInput
              style={[st.mInput, st.mArea]}
              placeholder="Write your message…"
              placeholderTextColor="#9CA3AF"
              value={draft.body}
              onChangeText={(v) => setF('body', v)}
              multiline
              textAlignVertical="top"
            />

            <Text style={st.mLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[st.catPick, draft.category === c && st.catPickActive]}
                  onPress={() => setF('category', c)}
                >
                  <Text style={[st.catPickTx, draft.category === c && st.catPickTxActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={st.mBtn} onPress={submit} disabled={posting}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={st.mBtnTx}>Post announcement</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setComposeOpen(false)}><Text style={st.mCancel}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: {
    backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  iconBtn: { width: 32, alignItems: 'flex-start' },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 18, fontWeight: '700' },

  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardPinned: { borderWidth: 1.5, borderColor: '#C7D2FE', backgroundColor: '#FBFBFF' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catChip: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  catChipTx: { fontSize: 10.5, fontWeight: '700' },
  pin: { fontSize: 14 },
  trash: { fontSize: 14 },

  title: { fontSize: 16, fontWeight: '800', color: T.ink, marginBottom: 6 },
  bodyTx: { fontSize: 13.5, color: T.sub, lineHeight: 20 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  authorDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  authorDotTx: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  author: { fontSize: 12.5, color: T.ink, fontWeight: '600' },
  metaSep: { color: T.faint },
  time: { fontSize: 12, color: T.faint },

  empty: { alignItems: 'center', paddingTop: 90, gap: 10 },
  emptyTx: { fontSize: 15, color: T.ink, fontWeight: '700' },
  emptySub: { fontSize: 12.5, color: T.faint, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },

  fab: {
    position: 'absolute', right: 20, bottom: 24, backgroundColor: T.primary,
    borderRadius: 26, paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: T.primary, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabTx: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  mOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  mSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 14 },
  mHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  mTitle: { fontSize: 18, fontWeight: '800', color: T.ink },
  mSub: { fontSize: 13, color: T.sub, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  mInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 13, marginBottom: 12, fontSize: 15, color: T.ink, backgroundColor: '#FAFAFA' },
  mArea: { minHeight: 96 },
  mLabel: { fontSize: 11, fontWeight: '700', color: '#374151', letterSpacing: 0.8, marginBottom: 6, marginTop: 2 },
  catPick: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F3F4F6' },
  catPickActive: { backgroundColor: T.primary },
  catPickTx: { fontSize: 13, color: T.sub, fontWeight: '600' },
  catPickTxActive: { color: '#FFF' },
  mBtn: { backgroundColor: T.primary, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 16 },
  mBtnTx: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  mCancel: { color: T.sub, textAlign: 'center', marginTop: 14, fontWeight: '600', fontSize: 14 },
});
