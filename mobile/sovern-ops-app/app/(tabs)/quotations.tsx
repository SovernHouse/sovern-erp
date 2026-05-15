// ─── Quotations Screen ────────────────────────────────────────────────────
// Phase 4.6 part 3: same perf pass as customers + leads. Row memoized,
// search/status filter derived via useMemo (was double-render via
// setFiltered effect), renderItem + keyExtractor stable via useCallback,
// FlatList virtualization tuned.
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getQuotations, type Quotation } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: COLORS.muted },
  sent:     { label: 'Sent',     color: COLORS.statusProposal },
  accepted: { label: 'Accepted', color: COLORS.success },
  rejected: { label: 'Rejected', color: COLORS.error },
  expired:  { label: 'Expired',  color: COLORS.statusClosed },
};

function formatCurrency(value?: number, currency = 'USD') {
  if (value === undefined || value === null) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

const QuotationRow = memo(function QuotationRow({ q, onPress }: { q: Quotation; onPress: () => void }) {
  const cfg = STATUS_CONFIG[q.status] ?? { label: q.status, color: COLORS.muted };
  const amount = formatCurrency(q.total, q.currency);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.statusBar, { backgroundColor: cfg.color }]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.quotationNumber}>{q.quotationNumber}</Text>
          <View style={[styles.statusChip, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        {q.customer?.companyName
          ? <Text style={styles.customerName}>{q.customer.companyName}</Text>
          : null}
        <View style={styles.rowMeta}>
          {amount ? <Text style={styles.amount}>{amount}</Text> : null}
          {q.factory?.companyName
            ? <Text style={styles.tag}>🏭 {q.factory.companyName}</Text>
            : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function QuotationsScreen() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // Phase 4.8 Commit 3d — sort-by-stage default so the full lifecycle
  // breakdown is visible on open instead of only the newest cohort.
  const [sortMode, setSortMode] = useState<'stage' | 'recent'>('stage');

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      // Phase 4.8 Commit 3d — bumped from 50 so sort/filter operate on
      // the full dataset, not the newest 50.
      const res = await getQuotations({ page: 1, limit: 200 });
      setQuotations(res.data);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Phase 4.6 part 3: composite filter via useMemo (was setFiltered effect).
  const filtered = useMemo(() => {
    let list = quotations;
    if (statusFilter) list = list.filter((q) => q.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((item) =>
        item.quotationNumber.toLowerCase().includes(q) ||
        (item.customer?.companyName ?? '').toLowerCase().includes(q) ||
        (item.factory?.companyName ?? '').toLowerCase().includes(q)
      );
    }
    if (sortMode === 'stage') {
      const order: Record<string, number> = { draft: 0, sent: 1, accepted: 2, rejected: 3, expired: 4 };
      list = [...list].sort((a, b) => {
        const oa = order[a.status] ?? 99;
        const ob = order[b.status] ?? 99;
        if (oa !== ob) return oa - ob;
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
    }
    return list;
  }, [search, statusFilter, sortMode, quotations]);

  const renderItem = useCallback(({ item }: { item: Quotation }) => (
    <QuotationRow q={item} onPress={() => router.push(`/quotation/${item.id}`)} />
  ), [router]);
  const keyExtractor = useCallback((item: Quotation) => item.id, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  const STATUS_FILTERS = ['draft', 'sent', 'accepted', 'rejected'];

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search quotations..."
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Phase 4.8 Commit 3d — sort toggle */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        <TouchableOpacity
          style={[styles.sortPill, sortMode === 'stage' && styles.sortPillActive]}
          onPress={() => setSortMode('stage')}
        >
          <Text style={[styles.sortPillText, sortMode === 'stage' && styles.sortPillTextActive]}>By stage</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortPill, sortMode === 'recent' && styles.sortPillActive]}
          onPress={() => setSortMode('recent')}
        >
          <Text style={[styles.sortPillText, sortMode === 'recent' && styles.sortPillTextActive]}>Recent</Text>
        </TouchableOpacity>
      </View>

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === null && styles.filterChipActive]}
          onPress={() => setStatusFilter(null)}
        >
          <Text style={[styles.filterChipText, statusFilter === null && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        {STATUS_FILTERS.map((s) => {
          const cfg = STATUS_CONFIG[s];
          const active = statusFilter === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, active && { borderColor: cfg.color, backgroundColor: cfg.color + '18' }]}
              onPress={() => setStatusFilter(active ? null : s)}
            >
              <Text style={[styles.filterChipText, active && { color: cfg.color, fontWeight: '700' }]}>
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
            <Text style={styles.emptyText}>No quotations found.</Text>
          </View>
        )}
        contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
        // Phase 4.6 part 3 — virtualization tuning.
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
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: 12,
    marginBottom: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.ink },
  clearBtn:    { fontSize: 16, color: COLORS.muted, padding: 4 },
  // Phase 4.8 Commit 3d — sort toggle row
  sortRow:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  sortLabel:         { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  sortPill:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  sortPillActive:    { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  sortPillText:      { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  sortPillTextActive:{ color: COLORS.white },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterChipActive: { borderColor: COLORS.forest, backgroundColor: COLORS.forest + '18' },
  filterChipText:   { fontSize: 12, color: COLORS.muted },
  filterChipTextActive: { color: COLORS.forest, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  statusBar: { width: 4 },
  rowBody:   { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  quotationNumber: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText:   { fontSize: 11, fontWeight: '600' },
  customerName: { fontSize: 13, color: COLORS.muted, marginBottom: 4 },
  rowMeta:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amount:       { fontSize: 14, fontWeight: '700', color: COLORS.forest },
  tag:          { fontSize: 12, color: COLORS.muted },

  separator: { height: 1, backgroundColor: COLORS.border },
  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.muted, fontSize: 14 },
});
