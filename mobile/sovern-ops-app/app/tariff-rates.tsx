// ─── Tariff Rates Screen (read-only) ─────────────────────────────────────
// Phase 4.9 C-2. Mobile parity for the desktop /settings/tariff-rates
// admin page. Read-only — mutations are super-admin desktop only per the
// brief (mobile admin surface is intentionally narrower).

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator,
  TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { listTariffRates, type TariffRate } from '../src/services/api';
import { COLORS } from '../src/constants/config';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysFromToday(iso: string) {
  const a = new Date(todayISO()).getTime();
  const b = new Date(iso).getTime();
  return Math.round((b - a) / 86400000);
}

function ExpiryBadge({ effectiveUntil }: { effectiveUntil: string }) {
  const diff = daysFromToday(effectiveUntil);
  if (diff < 0) {
    return (
      <View style={[styles.badge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
        <Text style={[styles.badgeText, { color: '#991B1B' }]}>Expired {-diff}d ago</Text>
      </View>
    );
  }
  if (diff <= 7) {
    return (
      <View style={[styles.badge, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
        <Text style={[styles.badgeText, { color: '#92400E' }]}>Expires in {diff}d</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: COLORS.white, borderColor: COLORS.border }]}>
      <Text style={[styles.badgeText, { color: COLORS.muted }]}>{diff}d</Text>
    </View>
  );
}

export default function TariffRatesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<TariffRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExpired, setShowExpired] = useState(false);

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await listTariffRates({ includeExpired: showExpired });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('[tariff-rates]', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [showExpired]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.forest} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Tariff rates</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          US tariff policy moves fast. Confirm with factory before quoting a rate near expiry. Edit on desktop (super-admin).
        </Text>
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show expired</Text>
        <TouchableOpacity
          style={[styles.togglePill, showExpired && styles.togglePillActive]}
          onPress={() => setShowExpired(!showExpired)}
        >
          <Text style={[styles.togglePillText, showExpired && styles.togglePillTextActive]}>
            {showExpired ? 'On' : 'Off'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />}
        contentContainerStyle={rows.length === 0 ? { flex: 1, justifyContent: 'center' } : { padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No tariff rates {showExpired ? 'at all' : 'in effect'}.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.pair}>{item.originCountry} → {item.destinationCountry}</Text>
              {item.brandCode ? <Text style={styles.brand}>{item.brandCode}</Text> : null}
            </View>
            <View style={styles.cardMiddle}>
              <Text style={styles.rate}>{Number(item.ratePercent).toFixed(4)}%</Text>
              <ExpiryBadge effectiveUntil={item.effectiveUntil} />
            </View>
            <Text style={styles.dates}>
              {item.effectiveFrom} → {item.effectiveUntil}
            </Text>
            {Array.isArray(item.components) && item.components.length > 0 && (
              <View style={styles.componentBlock}>
                <Text style={styles.componentHeader}>BREAKDOWN</Text>
                {item.components.map((comp, i) => (
                  <View key={i} style={styles.componentRow}>
                    <Text style={styles.componentName} numberOfLines={1}>· {comp.name}</Text>
                    <Text style={styles.componentRate}>{Number(comp.ratePercent).toFixed(4)}%</Text>
                  </View>
                ))}
              </View>
            )}
            {item.sourceNote ? <Text style={styles.source} numberOfLines={2}>{item.sourceNote}</Text> : null}
          </View>
        )}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.forest, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14 },
  backBtn:   { padding: 4 },
  backText:  { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  title:     { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  banner:    { backgroundColor: '#FEF3C7', padding: 10, marginHorizontal: 12, marginTop: 10, borderRadius: 6, borderWidth: 1, borderColor: '#FCD34D' },
  bannerText:{ fontSize: 11, color: '#92400E' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  toggleLabel:{ fontSize: 13, color: COLORS.steel, fontWeight: '600' },
  togglePill:{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.muted, backgroundColor: COLORS.white },
  togglePillActive: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  togglePillText:{ fontSize: 12, fontWeight: '600', color: COLORS.steel },
  togglePillTextActive: { color: COLORS.white },
  empty:     { textAlign: 'center', color: COLORS.muted, fontStyle: 'italic' },
  card:      { backgroundColor: COLORS.white, borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pair:      { fontSize: 14, fontWeight: '700', color: COLORS.forest, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  brand:     { fontSize: 11, fontWeight: '700', color: COLORS.muted, backgroundColor: COLORS.cream, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  cardMiddle:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  rate:      { fontSize: 22, fontWeight: '800', color: COLORS.ink, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  dates:     { fontSize: 11, color: COLORS.muted, marginBottom: 4 },
  source:    { fontSize: 11, color: COLORS.muted, fontStyle: 'italic' },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  componentBlock:  { marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: COLORS.border },
  componentHeader: { fontSize: 9, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.8, marginBottom: 4 },
  componentRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  componentName:   { flex: 1, fontSize: 11, color: COLORS.steel },
  componentRate:   { fontSize: 11, color: COLORS.ink, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
