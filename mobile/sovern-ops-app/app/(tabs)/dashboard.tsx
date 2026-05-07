// ─── Home Screen ──────────────────────────────────────────────────────────────
// Entry point for the app. Shows pipeline metrics at the top + a scrollable
// grid of all modules below (Odoo-style app launcher).
// Adding a new module: append a tile to MODULES and create the tab screen.

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getDashboard, type DashboardSummary } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';
import { useAuthStore } from '../../src/store/authStore';

// ─── Module grid definition ───────────────────────────────────────────────────
// To add a module: append here + register a Tabs.Screen in _layout.tsx.

const MODULES = [
  { icon: '👥', label: 'Leads',           route: '/(tabs)/leads' },
  { icon: '💬', label: 'Quotations',      route: '/(tabs)/quotations' },
  { icon: '📨', label: 'Inquiries',       route: '/(tabs)/inquiries' },
  { icon: '✅', label: 'Approvals',       route: '/(tabs)/approvals' },
  { icon: '🗓️', label: 'Activities',      route: '/(tabs)/activities' },
  { icon: '🚢', label: 'Shipments',       route: '/(tabs)/shipments' },
  { icon: '🧾', label: 'Invoices',        route: '/(tabs)/invoices' },
  { icon: '📋', label: 'Purchase Orders', route: '/(tabs)/purchase-orders' },
  { icon: '📦', label: 'Products',        route: '/(tabs)/products' },
  { icon: '🏢', label: 'Customers',       route: '/(tabs)/customers' },
  { icon: '🏭', label: 'Factories',       route: '/(tabs)/factories' },
  { icon: '✦',  label: 'AI Assistant',   route: '/(tabs)/assistant' },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, accent, onPress,
}: {
  label: string; value: string | number; sub?: string; accent?: string; onPress?: () => void;
}) {
  const card = (
    <View style={[styles.card, { borderLeftColor: accent ?? COLORS.forest }, onPress && styles.cardTappable]}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
      {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={{ flex: 1 }} onPress={onPress} activeOpacity={0.75}>
        {card}
      </TouchableOpacity>
    );
  }
  return <View style={{ flex: 1 }}>{card}</View>;
}

function ModuleTile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const summary = await getDashboard();
      setData(summary);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

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
      {/* Greeting */}
      <Text style={styles.greeting}>
        Good {getTimeOfDay()},{'\n'}{user?.name?.split(' ')[0] ?? 'Alex'}.
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Pipeline metrics */}
      <Text style={styles.sectionTitle}>Pipeline</Text>
      <View style={styles.metricGrid}>
        <MetricCard
          label="Open Leads"
          value={data?.openLeads ?? '--'}
          accent={COLORS.statusNew}
          onPress={() => router.push('/(tabs)/leads')}
        />
        <MetricCard
          label="Pending Approvals"
          value={data?.pendingApprovals ?? '--'}
          accent={COLORS.warning}
          sub={data?.pendingApprovals ? 'Needs review' : undefined}
          onPress={() => router.push('/(tabs)/approvals')}
        />
      </View>
      <View style={styles.metricGrid}>
        <MetricCard
          label="Open Activities"
          value={data?.pendingActivities ?? '--'}
          accent={COLORS.statusQualified}
          onPress={() => router.push('/(tabs)/activities')}
        />
        <MetricCard
          label="Pipeline Value"
          value={data?.pipelineValueUSD != null ? `$${(data.pipelineValueUSD / 1000).toFixed(0)}k` : '--'}
          sub="USD"
          accent={COLORS.forest}
        />
      </View>

      {data?.lastUpdated ? (
        <Text style={styles.updated}>
          Updated {new Date(data.lastUpdated).toLocaleTimeString()}
        </Text>
      ) : null}

      {/* Module grid */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Modules</Text>
      <View style={styles.moduleGrid}>
        {MODULES.map(m => (
          <ModuleTile
            key={m.route}
            icon={m.icon}
            label={m.label}
            onPress={() => router.push(m.route as any)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content:   { padding: 20, paddingBottom: 40 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },

  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 24,
    lineHeight: 34,
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  // Metric cards
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTappable: {
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
  },
  cardLabel: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  cardSub: {
    fontSize: 11,
    color: COLORS.warning,
    fontWeight: '600',
    marginTop: 4,
  },
  updated: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },

  // Module grid
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    // 3-column grid with gap — width = (100% - 2 gaps) / 3
    width: '30.5%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tileIcon:  { fontSize: 26 },
  tileLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.ink,
    textAlign: 'center',
    lineHeight: 14,
  },

  // Error
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
  },
});
