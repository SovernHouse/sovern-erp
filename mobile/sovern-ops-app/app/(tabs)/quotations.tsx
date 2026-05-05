// ─── Quotations Screen ────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
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

function QuotationRow({ q, onPress }: { q: Quotation; onPress: () => void }) {
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
}

export default function QuotationsScreen() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [filtered, setFiltered] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await getQuotations({ page: 1, limit: 50 });
      setQuotations(res.data);
      setFiltered(res.data);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
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
    setFiltered(list);
  }, [search, statusFilter, quotations]);

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
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <QuotationRow
            q={item}
            onPress={() => router.push(`/quotation/${item.id}`)}
          />
        )}
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
