// ─── PriceLists list screen — Phase 4.28b mobile parity ─────────────────────
//
// Reachable from Settings → "Price Lists". Tapping a row pushes
// /price-list/[id] with the full detail (smart counts + chatter +
// PDF/email/approval actions).

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { listPriceLists, type PriceListRow } from '../src/services/api';
import { COLORS } from '../src/constants/config';

function fmt(date?: string | null) {
  if (!date) return '—';
  try { return new Date(date).toLocaleDateString('en-GB'); } catch (_) { return String(date); }
}

function parentLabel(pl: PriceListRow): string {
  if (pl.Customer && pl.Customer.companyName) return `Client · ${pl.Customer.companyName}`;
  if (pl.Factory  && pl.Factory.companyName)  return `Supplier · ${pl.Factory.companyName}`;
  return 'Template';
}

export default function PriceListsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const [rows, setRows] = useState<PriceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { navigation.setOptions({ title: 'Price Lists' }); }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await listPriceLists();
      setRows(data);
    } catch (_) {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {rows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💰</Text>
          <Text style={styles.emptyTitle}>No price lists</Text>
          <Text style={styles.emptySubtitle}>
            Create one from the desktop ERP or ask the AI assistant to use{' '}
            <Text style={styles.code}>create_price_list</Text>.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push(`/price-list/${item.id}`)}
              style={[styles.card, !item.isActive && styles.cardInactive]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.name || '(unnamed)'}</Text>
                <View style={[styles.pill, item.isActive ? styles.pillActive : styles.pillInactive]}>
                  <Text style={[styles.pillText, item.isActive ? styles.pillTextActive : styles.pillTextInactive]}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle} numberOfLines={1}>{parentLabel(item)}</Text>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMeta}>{item.currencyCode}</Text>
                <Text style={styles.cardMetaSep}>·</Text>
                <Text style={styles.cardMeta}>{item.itemCount ?? 0} items</Text>
                {(item.validFrom || item.validTo) && (
                  <>
                    <Text style={styles.cardMetaSep}>·</Text>
                    <Text style={styles.cardMeta}>{fmt(item.validFrom)} → {fmt(item.validTo)}</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },

  emptyState: { padding: 32, alignItems: 'center', justifyContent: 'center', flex: 1 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 18 },
  code: { fontFamily: 'Courier', color: COLORS.ink },

  card: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardInactive: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.ink },
  cardSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 6 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  cardMeta: { fontSize: 12, color: COLORS.muted },
  cardMetaSep: { fontSize: 12, color: '#D1D5DB', marginHorizontal: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 },
  pillActive: { backgroundColor: '#DCFCE7' },
  pillInactive: { backgroundColor: '#F1F5F9' },
  pillText: { fontSize: 10, fontWeight: '700' },
  pillTextActive: { color: '#15803D' },
  pillTextInactive: { color: COLORS.muted },
});
