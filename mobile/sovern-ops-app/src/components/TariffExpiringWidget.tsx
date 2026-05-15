// ─── TariffExpiringWidget (mobile) — Phase 4.9 C-5 ───────────────────────
//
// Mirrors the desktop dashboard widget. Self-hides when no rows are at
// risk so the dashboard stays clean for users who don't touch US imports.

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { listTariffRates, type TariffRate } from '../services/api';
import { COLORS } from '../constants/config';

function daysFromToday(iso: string) {
  const a = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const b = new Date(iso).getTime();
  return Math.round((b - a) / 86400000);
}

type Flagged = TariffRate & { _days: number };

export default function TariffExpiringWidget() {
  const router = useRouter();
  const [rows, setRows] = useState<Flagged[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTariffRates({ includeExpired: true })
      .then(r => {
        const all = Array.isArray(r.data) ? r.data : [];
        const flagged = all
          .map(x => ({ ...x, _days: daysFromToday(x.effectiveUntil) }))
          .filter(x => x._days <= 7 && x._days >= -30)
          .sort((a, b) => a._days - b._days);
        if (!cancelled) {
          setRows(flagged);
          setLoaded(true);
        }
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  if (!loaded || rows.length === 0) return null;

  const expiredCount = rows.filter(r => r._days < 0).length;
  const expiringCount = rows.length - expiredCount;

  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push('/tariff-rates' as any)}>
      <Text style={styles.header}>
        {expiredCount > 0 && `${expiredCount} tariff${expiredCount === 1 ? '' : 's'} expired`}
        {expiredCount > 0 && expiringCount > 0 && '  ·  '}
        {expiringCount > 0 && `${expiringCount} expiring ≤7d`}
      </Text>
      {rows.slice(0, 4).map(r => (
        <View key={r.id} style={styles.row}>
          <Text style={styles.pair}>{r.originCountry} → {r.destinationCountry}</Text>
          <Text style={styles.meta}>
            <Text style={styles.rate}>{Number(r.ratePercent).toFixed(4)}%</Text>
            {' · '}
            <Text style={styles.expiry}>{r._days < 0 ? `expired ${-r._days}d` : `${r._days}d left`}</Text>
          </Text>
        </View>
      ))}
      {rows.length > 4 && <Text style={styles.more}>+ {rows.length - 4} more</Text>}
      <Text style={styles.cta}>Tap to manage on desktop</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:    { backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1, borderRadius: 8, padding: 12, marginVertical: 8 },
  header:  { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 8 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  pair:    { fontSize: 12, color: '#92400E', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  meta:    { fontSize: 11, color: '#92400E' },
  rate:    { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  expiry:  { fontStyle: 'italic' },
  more:    { fontSize: 11, color: '#92400E', fontStyle: 'italic', marginTop: 4 },
  cta:     { fontSize: 11, color: '#92400E', textDecorationLine: 'underline', marginTop: 6, textAlign: 'right' },
});
