// FlorWay commission detail screen — Phase 4, C15 mobile.
//
// Read-only on mobile. Per-order rate edits + mark-paid / claw-back
// stay desktop-only (the inline-edit table is a bigger-screen UX).
//
// Visible only when accessibleBrands.includes('FW'). The CommissionWidget
// on the dashboard navigates here on tap. Direct deep-link returns a
// guard message for SH-only users.

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useBrands } from '../src/hooks/useBrands';
import { COLORS, CONFIG } from '../src/constants/config';

type Kpis = { mtdAccrued: number; qtdAccrued: number; ytdAccrued: number; pendingPayment: number };
type Deal = {
  id: string;
  orderNumber: string | null;
  customerName: string | null;
  accrualDate: string | null;
  amount: number;
  percentage: number;
  status: string;
  daysOpen: number | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  accrued:             { label: 'Accrued',             color: '#92400E' },
  invoiced_to_factory: { label: 'Invoiced to factory', color: '#1E40AF' },
  paid:                { label: 'Paid',                color: '#065F46' },
  disputed:            { label: 'Disputed',            color: '#991B1B' },
  clawed_back:         { label: 'Clawed back',         color: '#374151' },
  pending:             { label: 'Pending (legacy)',    color: '#374151' },
};

function fmtMoney(v: number, currency = 'USD') {
  if (v == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(Number(v));
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Taipei',
  });
}

export default function CommissionScreen() {
  const { accessibleBrands } = useBrands();
  const router = useRouter();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [outstanding, setOutstanding] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFw = accessibleBrands.includes('FW');

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const token = await SecureStore.getItemAsync(CONFIG.TOKEN_KEY);
      const res = await fetch(
        `${CONFIG.SERVER_URL}/api/personalization/commissions/dashboard?brand=FW`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const data = body.data || body;
      setKpis(data.kpis);
      setDeals(data.deals || []);
      setOutstanding(data.outstanding || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (hasFw) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFw]);

  if (!hasFw) {
    return (
      <View style={styles.center}>
        <Text style={styles.guardText}>FlorWay access required.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.guardBtn}>
          <Text style={styles.guardBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />
      }
    >
      <Text style={styles.title}>FlorWay Commission</Text>
      <Text style={styles.subtitle}>5% floor · per-order override editable on desktop</Text>

      {error ? <Text style={styles.error}>Unavailable: {error}</Text> : null}

      {/* KPI grid */}
      <View style={styles.kpiGrid}>
        <Kpi label="MTD" value={fmtMoney(kpis?.mtdAccrued ?? 0)} color="#1F2933" />
        <Kpi label="QTD" value={fmtMoney(kpis?.qtdAccrued ?? 0)} color="#1F2933" />
        <Kpi label="YTD" value={fmtMoney(kpis?.ytdAccrued ?? 0)} color="#1F2933" />
        <Kpi label="Pending payment" value={fmtMoney(kpis?.pendingPayment ?? 0)} color="#92400E" />
      </View>

      {outstanding.length > 0 ? (
        <>
          <Text style={styles.section}>Outstanding &gt; 30 days ({outstanding.length})</Text>
          {outstanding.map((d) => <DealRow key={d.id} deal={d} highlight />)}
        </>
      ) : null}

      <Text style={styles.section}>All deals ({deals.length})</Text>
      {deals.length === 0 ? (
        <Text style={styles.emptyText}>No commission rows yet. Confirm an FW sales order to accrue.</Text>
      ) : (
        deals.map((d) => <DealRow key={d.id} deal={d} />)
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.kpi, { borderLeftColor: color }]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function DealRow({ deal, highlight }: { deal: Deal; highlight?: boolean }) {
  const cfg = STATUS_LABEL[deal.status] || { label: deal.status, color: COLORS.muted };
  return (
    <View style={[styles.dealRow, highlight && styles.dealRowHighlight]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.dealOrder}>{deal.orderNumber || deal.id.slice(0, 8)}</Text>
        <Text style={styles.dealCustomer}>{deal.customerName || '—'}</Text>
        <Text style={styles.dealMeta}>
          {fmtDate(deal.accrualDate)} · {Number(deal.percentage).toFixed(2)}%
          {deal.daysOpen != null ? ` · ${deal.daysOpen}d open` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.dealAmount}>{fmtMoney(deal.amount)}</Text>
        <Text style={[styles.dealStatus, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content:   { padding: 16 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream, padding: 24 },
  title:     { fontSize: 22, fontWeight: '800', color: COLORS.ink, marginBottom: 4 },
  subtitle:  { fontSize: 12, color: COLORS.muted, marginBottom: 16 },
  section:   { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  error:     { fontSize: 12, color: COLORS.error, marginBottom: 8 },
  kpiGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi:       { flexBasis: '47%', backgroundColor: COLORS.white, borderRadius: 10, padding: 12, borderLeftWidth: 3, marginBottom: 4 },
  kpiLabel:  { fontSize: 10, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  kpiValue:  { fontSize: 18, fontWeight: '700', color: COLORS.ink, marginTop: 3 },
  dealRow:   { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.white, borderRadius: 10, padding: 12, marginBottom: 8 },
  dealRowHighlight: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' },
  dealOrder:    { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  dealCustomer: { fontSize: 12, color: COLORS.ink, marginTop: 2 },
  dealMeta:     { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  dealAmount:   { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  dealStatus:   { fontSize: 11, fontWeight: '600', marginTop: 4 },
  emptyText:    { fontSize: 12, color: COLORS.muted, padding: 16, textAlign: 'center' },
  guardText:    { fontSize: 14, color: COLORS.muted, marginBottom: 16 },
  guardBtn:     { backgroundColor: COLORS.forest, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  guardBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
});
