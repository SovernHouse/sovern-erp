// ─── Customers Screen ─────────────────────────────────────────────────────
// Read-only customer directory: search, browse, tap for contact details.
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView, Linking,
} from 'react-native';
import { getCustomers, getCustomer, type Customer } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

// ─── Customer Row ─────────────────────────────────────────────────────────

function CustomerRow({ customer, onPress }: { customer: Customer; onPress: () => void }) {
  const displayName = customer.companyName ?? customer.name ?? '';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.name}>{displayName}</Text>
        {customer.contactPerson ? (
          <Text style={styles.sub}>{customer.contactPerson}</Text>
        ) : null}
        {customer.country ? (
          <Text style={styles.country}>{customer.city ? `${customer.city}, ` : ''}{customer.country}</Text>
        ) : null}
      </View>
      {customer.status ? (
        <View style={[
          styles.statusChip,
          { backgroundColor: customer.status === 'active' ? COLORS.success + '22' : COLORS.muted + '22' }
        ]}>
          <Text style={[
            styles.statusText,
            { color: customer.status === 'active' ? COLORS.success : COLORS.muted }
          ]}>
            {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Customer Detail Modal ────────────────────────────────────────────────

function CustomerDetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomer(customerId)
      .then(setCustomer)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customerId]);

  function row(label: string, value?: string | null, isLink?: 'email' | 'phone') {
    if (!value) return null;
    return (
      <View style={styles.detailRow} key={label}>
        <Text style={styles.detailLabel}>{label}</Text>
        {isLink ? (
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(isLink === 'email' ? `mailto:${value}` : `tel:${value}`)
            }
          >
            <Text style={[styles.detailValue, styles.link]}>{value}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.detailValue}>{value}</Text>
        )}
      </View>
    );
  }

  const detailName = customer?.companyName ?? customer?.name ?? '';
  const initials = detailName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {loading ? 'Loading…' : (customer?.companyName ?? customer?.name ?? 'Customer')}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.forest} />
        ) : customer ? (
          <ScrollView contentContainerStyle={styles.detailScroll}>

            {/* Avatar block */}
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{initials}</Text>
            </View>

            {row('Contact', customer.contactPerson)}
            {row('Email', customer.email, 'email')}
            {row('Phone', customer.phone, 'phone')}
            {row('Industry', customer.industry)}
            {row('Country', customer.country)}
            {row('City', customer.city)}
            {row('Address', customer.address)}
            {row('Status', customer.status)}

            {customer.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.notesText}>{customer.notes}</Text>
              </View>
            ) : null}

          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>Customer not found.</Text>
        )}
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await getCustomers({ page: 1 });
      setCustomers(res.data);
      setFiltered(res.data);
    } catch (err: any) {
      console.error('Customers load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? customers.filter(
            (c) =>
              (c.companyName ?? c.name ?? '').toLowerCase().includes(q) ||
              (c.contactPerson ?? '').toLowerCase().includes(q) ||
              (c.country ?? '').toLowerCase().includes(q) ||
              (c.email ?? '').toLowerCase().includes(q)
          )
        : customers
    );
  }, [search, customers]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, contact, or country…"
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      {/* Count */}
      <Text style={styles.count}>
        {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
      </Text>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CustomerRow customer={item} onPress={() => setSelectedId(item.id)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={COLORS.forest}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No customers found.</Text>
          </View>
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyFlex : undefined}
      />

      {/* Detail Modal */}
      {selectedId ? (
        <CustomerDetailModal customerId={selectedId} onClose={() => setSelectedId(null)} />
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.cream },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },
  searchBar:   { margin: 12, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12 },
  searchInput: { height: 40, color: COLORS.ink, fontSize: 14 },
  count:       { paddingHorizontal: 16, paddingBottom: 4, fontSize: 12, color: COLORS.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.forest + '22',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: COLORS.forest },
  rowBody:    { flex: 1 },
  name:       { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  sub:        { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  country:    { fontSize: 12, color: COLORS.forest, marginTop: 1 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '600' },
  separator:  { height: 1, backgroundColor: COLORS.border },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyFlex:  { flex: 1 },
  emptyText:  { color: COLORS.muted, fontSize: 14 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.cream },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.forest,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 48,
  },
  modalTitle:    { flex: 1, color: COLORS.white, fontSize: 17, fontWeight: '700' },
  closeBtn:      { marginLeft: 12, padding: 4 },
  closeBtnText:  { color: COLORS.white, fontSize: 20 },
  detailScroll:  { padding: 16 },
  avatarLarge: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.forest + '22',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  avatarLargeText: { fontSize: 28, fontWeight: '700', color: COLORS.forest },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: { fontSize: 13, color: COLORS.muted, flex: 1 },
  detailValue: { fontSize: 13, color: COLORS.ink, fontWeight: '500', flex: 2, textAlign: 'right' },
  link:        { color: COLORS.forest, textDecorationLine: 'underline' },
  notesBox:    { paddingVertical: 10 },
  notesText:   { fontSize: 13, color: COLORS.ink, marginTop: 4, lineHeight: 20 },
});
