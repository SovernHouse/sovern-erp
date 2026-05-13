// ─── Leads Screen ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getLeads, type Lead } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';
import { BrandBadge } from '../../src/components/BrandBadge';

const STATUS_COLORS: Record<string, string> = {
  new:         COLORS.statusNew,
  contacted:   COLORS.statusContacted,
  qualified:   COLORS.statusQualified,
  proposal:    COLORS.statusProposal,
  negotiation: COLORS.statusNegotiation,
  closed:      COLORS.statusClosed,
};

function LeadRow({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const color = STATUS_COLORS[lead.status.toLowerCase()] ?? COLORS.muted;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <View style={styles.rowBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={styles.company}>{lead.companyName}</Text>
          <BrandBadge code={lead.brandCode || 'SH'} size="sm" showLabel={false} />
        </View>
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
}

export default function LeadsScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtered, setFiltered] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await getLeads({ page: 1 });
      setLeads(res.data);
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
    if (!search) { setFiltered(leads); return; }
    const q = search.toLowerCase();
    setFiltered(
      leads.filter((l) =>
        l.companyName.toLowerCase().includes(q) ||
        l.contactName.toLowerCase().includes(q) ||
        (l.productInterests ?? '').toLowerCase().includes(q)
      )
    );
  }, [search, leads]);

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

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <LeadRow
            lead={item}
            onPress={() => router.push(`/lead/${item.id}`)}
          />
        )}
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
