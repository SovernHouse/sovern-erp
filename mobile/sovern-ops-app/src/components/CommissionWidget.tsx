// CommissionWidget — Phase 3 C11 + Phase 4 C15 (rewired).
//
// Read-only summary: Accrued (MTD) + Pending Payment for the current
// Asia/Taipei MTD, brandCode=FW. Rendered only for users with FW in
// accessibleBrands. Tap → opens commission detail screen with full
// deals list. Per-order percentage edits happen on desktop.

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useBrands } from '../hooks/useBrands';
import { COLORS } from '../constants/config';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../constants/config';

type Kpis = { mtdAccrued: number; qtdAccrued?: number; ytdAccrued?: number; pendingPayment: number };

function fmtMoney(v: number, currency = 'USD') {
  if (v == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(Number(v));
}

export default function CommissionWidget() {
  const { accessibleBrands } = useBrands();
  const router = useRouter();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFw = accessibleBrands.includes('FW');

  useEffect(() => {
    if (!hasFw) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(CONFIG.TOKEN_KEY);
        // Phase 4, C15: use the new /dashboard endpoint so MTD/Pending
        // match the desktop dashboard.
        const res = await fetch(
          `${CONFIG.SERVER_URL}/api/personalization/commissions/dashboard?brand=FW`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        const data = body.data || body;
        if (!cancelled) setKpis(data.kpis);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hasFw]);

  if (!hasFw) return null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/commission')}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <Text style={styles.heading}>FlorWay Commission  ·  MTD</Text>
        {loading ? <ActivityIndicator size="small" color={COLORS.forest} /> : null}
      </View>
      <Text style={styles.subheading}>Tap for full deals list  ·  5% floor, adjustable on desktop</Text>
      {error ? (
        <Text style={styles.error}>Unavailable: {error}</Text>
      ) : (
        <View style={styles.tilesRow}>
          <Tile label="MTD Accrued" value={fmtMoney(kpis?.mtdAccrued ?? 0)} color="#1F2933" />
          <Tile label="Pending payment" value={fmtMoney(kpis?.pendingPayment ?? 0)} color="#92400E" />
        </View>
      )}
    </TouchableOpacity>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.tile, { borderLeftColor: color }]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  heading:    { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1 },
  subheading: { fontSize: 11, color: COLORS.muted, marginBottom: 10 },
  tilesRow:   { flexDirection: 'row', gap: 8 },
  tile:       { flex: 1, backgroundColor: '#FAFAF7', borderRadius: 8, padding: 10, borderLeftWidth: 3 },
  tileLabel:  { fontSize: 9, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  tileValue:  { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginTop: 3 },
  error:      { fontSize: 11, color: COLORS.error },
});
