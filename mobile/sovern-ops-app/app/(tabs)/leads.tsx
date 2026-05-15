// ─── Leads Screen ─────────────────────────────────────────────────────────
// Phase 4.5, C22: row component is memoized + renderItem is stable via
// useCallback so scrolling does not re-render unchanged rows. FlatList tuned
// for ~hundreds of rows: removeClippedSubviews, smaller maxToRenderPerBatch,
// windowSize=10 (defaults to 21). Search filter uses useMemo so the filter
// pass is not redone on every keystroke render.
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getLeads, type Lead } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';
import { BrandBadge } from '../../src/components/BrandBadge';

// Phase 4.8 Commit 3c — bucket-based palette per the audit doc.
// top-of-funnel (new, contacted) -> steel
// open pipeline (qualified, proposal, negotiation) -> brand accent
//   (forest for SH, iron for FW). Resolved per-row via stageColorForLead.
// terminal positive (won) -> green
// terminal negative (lost) -> bronze
function stageColorForLead(status: string, brandCode?: string | null): string {
  switch (status) {
    case 'new':
    case 'contacted':
      return COLORS.steel;
    case 'qualified':
    case 'proposal':
    case 'negotiation':
      return brandCode === 'FW' ? COLORS.iron : COLORS.forest;
    case 'won':
      return COLORS.won;
    case 'lost':
      return COLORS.bronze;
    default:
      return COLORS.muted;
  }
}

// Filter pill bar config. 'All' key is the empty string so === comparison
// against state's null/empty value matches without a special case.
const STATUS_FILTERS = [
  { key: '',            label: 'All' },
  { key: 'new',         label: 'New' },
  { key: 'contacted',   label: 'Contacted' },
  { key: 'qualified',   label: 'Qualified' },
  { key: 'proposal',    label: 'Proposal' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won',         label: 'Won' },
  { key: 'lost',        label: 'Lost' },
] as const;

const LeadRow = memo(function LeadRow({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  // Phase 4.8 Commit 3c — bucket-based color, brand-accent for open
  // pipeline stages so SH and FW Leads are visually distinct at-a-glance.
  const color = stageColorForLead(lead.status.toLowerCase(), lead.brandCode);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <View style={styles.rowBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={styles.company}>{lead.companyName}</Text>
          <BrandBadge code={lead.brandCode || 'SH'} size="sm" showLabel={false} />
        </View>
        {/* Phase 4.8 Commit 3a: human-readable LD-YYYYMMDD-NNN under the company name */}
        {lead.leadNumber ? <Text style={styles.leadNumber}>{lead.leadNumber}</Text> : null}
        <Text style={styles.contact}>{lead.contactName}</Text>
        {lead.productInterests
          ? <Text style={styles.product}>{lead.productInterests}</Text>
          : null
        }
      </View>
      <View style={[styles.statusChip, { backgroundColor: color + '22', borderColor: color }]}>
        <Text style={[styles.statusText, { color }]}>
          {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default function LeadsScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  // Phase 4.8 Commit 3c — status filter pill bar at top of list.
  const [statusFilter, setStatusFilter] = useState<string>('');

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await getLeads({ page: 1 });
      setLeads(res.data);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Phase 4.5, C22 + Phase 4.8 Commit 3c: derived filter combines status
  // pill + search query. useMemo avoids the double-render the old
  // setFiltered effect caused.
  const filtered = useMemo(() => {
    let list = leads;
    if (statusFilter) list = list.filter((l) => l.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.companyName.toLowerCase().includes(q) ||
        l.contactName.toLowerCase().includes(q) ||
        (l.productInterests ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, statusFilter, leads]);

  // Phase 4.5, C22: stable renderItem + keyExtractor so memoized rows can
  // skip re-rendering when only siblings change.
  const renderItem = useCallback(({ item }: { item: Lead }) => (
    <LeadRow lead={item} onPress={() => router.push(`/lead/${item.id}`)} />
  ), [router]);
  const keyExtractor = useCallback((item: Lead) => String(item.id), []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search leads..."
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Phase 4.8 Commit 3c — status filter pill bar. Horizontal scroll
          so the 8 stages fit on narrow screens. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key || 'all'}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />
        }
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No leads found.</Text>
          </View>
        )}
        contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
        // Phase 4.5, C22 — virtualization tuning.
        // removeClippedSubviews drops native views outside the viewport (Android
        // wins more here than iOS, but it is safe on both).
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
  },
  clearBtn: { fontSize: 16, color: COLORS.muted, padding: 4 },
  // Phase 4.8 Commit 3c — filter pill bar
  filterRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterPillActive:     { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  filterPillText:       { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  filterPillTextActive: { color: COLORS.white },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowBody: { flex: 1 },
  company: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  leadNumber: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: COLORS.muted, marginTop: 2 },
  contact: { fontSize: 13, color: COLORS.muted, marginTop: 1 },
  product: { fontSize: 12, color: COLORS.forest, marginTop: 3 },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 38 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.muted, fontSize: 14 },
});
