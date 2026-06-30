import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { assetApi } from '../../services/api';

/* ── Types ── */
type AssetStatus = 'Active' | 'Returned';
type Condition   = 'Good' | 'Fair' | 'Poor' | 'New';

const CATEGORY_EMOJI: Record<string, string> = {
  Laptop: '💻', Monitor: '🖥️', Phone: '📱', Accessory: '🖱️', Peripheral: '🖱️', Furniture: '🪑',
};
function mapAsset(a: any): Asset {
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    brand: a.brand || '—',
    serial: a.serialNumber || '—',
    assetId: a.assetTag,
    assignedOn: a.assignedDate ? new Date(a.assignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    condition: (a.condition as Condition) || 'Good',
    status: a.status === 'returned' ? 'Returned' : 'Active',
    emoji: CATEGORY_EMOJI[a.category] || '📦',
  };
}

interface Asset {
  id: string;
  name: string;
  category: string;
  brand: string;
  serial: string;
  assetId: string;
  assignedOn: string;
  condition: Condition;
  status: AssetStatus;
  emoji: string;
}

/* ── Mock data (replace with API) ── */
const ASSETS: Asset[] = [
  {
    id: '1', name: 'MacBook Pro 14"', category: 'Laptop', brand: 'Apple',
    serial: 'MBP-2024-00142', assetId: 'AST-00089', assignedOn: '12 Jan 2025',
    condition: 'Good', status: 'Active', emoji: '💻',
  },
  {
    id: '2', name: 'Wireless Mouse', category: 'Peripheral', brand: 'Logitech',
    serial: 'LGT-MX-00341', assetId: 'AST-00090', assignedOn: '12 Jan 2025',
    condition: 'Good', status: 'Active', emoji: '🖱️',
  },
  {
    id: '3', name: 'Ergonomic Chair', category: 'Furniture', brand: 'Herman Miller',
    serial: 'CHR-2024-0021', assetId: 'AST-00045', assignedOn: '08 Jan 2025',
    condition: 'Fair', status: 'Active', emoji: '🪑',
  },
];

/* ── Condition colour map ── */
const CONDITION_COLOR: Record<Condition, string> = {
  New:  '#4F46E5',
  Good: '#10B981',
  Fair: '#F59E0B',
  Poor: '#EF4444',
};

export default function AssetsScreen({ navigation }: any) {
  const employee = useSelector((st: RootState) => st.auth.employee);
  const [assets, setAssets] = useState<Asset[]>(ASSETS);

  useEffect(() => {
    if (!employee?.id) return;
    (async () => {
      try {
        const { data } = await assetApi.getByEmployee(employee.id);
        if (Array.isArray(data) && data.length) setAssets(data.map(mapAsset));
      } catch { /* keep mock */ }
    })();
  }, [employee?.id]);

  const total    = assets.length;
  const active   = useMemo(() => assets.filter(a => a.status === 'Active').length, [assets]);
  const returned = useMemo(() => assets.filter(a => a.status === 'Returned').length, [assets]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => navigation?.canGoBack?.() && navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Assets</Text>
        <View style={s.avatar}><Text style={s.avatarText}>AD</Text></View>
      </View>

      {/* ── Summary chips ── */}
      <View style={s.chipsRow}>
        <View style={s.chip}>
          <Text style={s.chipEmoji}>📦</Text>
          <Text style={s.chipText}>Total</Text>
          <Text style={s.chipDot}>·</Text>
          <Text style={s.chipCount}>{total}</Text>
        </View>
        <View style={s.chip}>
          <Text style={s.chipEmoji}>✅</Text>
          <Text style={s.chipText}>Active</Text>
          <Text style={s.chipDot}>·</Text>
          <Text style={[s.chipCount, { color: '#10B981' }]}>{active}</Text>
        </View>
        <View style={s.chip}>
          <Text style={s.chipEmoji}>📥</Text>
          <Text style={s.chipText}>Returned</Text>
          <Text style={s.chipDot}>·</Text>
          <Text style={[s.chipCount, { color: '#6B7280' }]}>{returned}</Text>
        </View>
      </View>

      {/* ── Asset list ── */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Text style={s.sectionLabel}>ASSIGNED TO ME</Text>

        {assets.map(asset => (
          <View key={asset.id} style={s.card}>
            {/* Top row: icon + name + status */}
            <View style={s.cardTop}>
              <View style={s.iconCircle}>
                <Text style={s.iconEmoji}>{asset.emoji}</Text>
              </View>
              <View style={s.cardTitleWrap}>
                <Text style={s.assetName}>{asset.name}</Text>
                <Text style={s.assetCategory}>{asset.category} · {asset.brand}</Text>
              </View>
              <View style={[s.statusBadge, asset.status === 'Returned' && s.statusReturned]}>
                <Text style={[s.statusText, asset.status === 'Returned' && s.statusTextReturned]}>
                  {asset.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={s.divider} />

            {/* Detail grid */}
            <View style={s.detailGrid}>
              <View style={s.detailCol}>
                <Text style={s.detailLabel}>SERIAL NUMBER</Text>
                <Text style={s.detailValue}>{asset.serial}</Text>
              </View>
              <View style={s.detailCol}>
                <Text style={s.detailLabel}>CONDITION</Text>
                <Text style={[s.detailValue, { color: CONDITION_COLOR[asset.condition] }]}>
                  {asset.condition}
                </Text>
              </View>
            </View>

            <View style={s.detailGrid}>
              <View style={s.detailCol}>
                <Text style={s.detailLabel}>ASSIGNED ON</Text>
                <Text style={s.detailValue}>{asset.assignedOn}</Text>
              </View>
              <View style={s.detailCol}>
                <Text style={s.detailLabel}>ASSET ID</Text>
                <Text style={s.detailValue}>{asset.assetId}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* ════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1E1B4B' },

  /* header */
  header: {
    backgroundColor: '#1E1B4B',
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  iconBtn:   { width: 32, alignItems: 'flex-start' },
  backArrow: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 18, fontWeight: '700' },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 12 },

  /* summary chips */
  chipsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 20,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
  },
  chipEmoji: { fontSize: 13 },
  chipText:  { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  chipDot:   { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginHorizontal: 1 },
  chipCount: { fontSize: 13, color: '#FFF', fontWeight: '800' },

  /* scroll sheet */
  scroll: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 0.8, marginHorizontal: 16, marginBottom: 12,
  },

  /* card */
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  iconEmoji: { fontSize: 20 },
  cardTitleWrap: { flex: 1 },
  assetName:     { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  assetCategory: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  statusBadge: {
    backgroundColor: '#D1FAE5', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  statusReturned: { backgroundColor: '#F3F4F6' },
  statusText:     { fontSize: 10, fontWeight: '700', color: '#065F46', letterSpacing: 0.5 },
  statusTextReturned: { color: '#6B7280' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 14 },

  /* detail grid */
  detailGrid: { flexDirection: 'row', marginBottom: 12 },
  detailCol:  { flex: 1 },
  detailLabel: {
    fontSize: 10, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 0.6, marginBottom: 4,
  },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
});
