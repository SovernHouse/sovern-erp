// ─── Customers Screen ─────────────────────────────────────────────────────
// Read-only customer directory: search, browse, tap for contact details.
//
// Phase 4.5, C22: memoized CustomerRow, useCallback renderItem, useMemo
// filtered list, FlatList virtualization tuning. Search no longer triggers
// a double render (setFiltered effect dropped in favour of derived state).
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView, Linking, Alert,
  Platform,
} from 'react-native';
import {
  getCustomers, getCustomer, deleteCustomer, getCustomerProfitability,
  type Customer, type CustomerProfitability,
} from '../../src/services/api';
import { COLORS } from '../../src/constants/config';
import { BrandBadge, BrandBadgeGroup } from '../../src/components/BrandBadge';
import { useBrands } from '../../src/hooks/useBrands';
import ProductBrandingModePicker from '../../src/components/ProductBrandingModePicker';
import ContactsSection from '../../src/components/ContactsSection';

// ─── Profitability helpers ───────────────────────────────────────────────

const USD_FMT = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});

function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
function monthsAgo(months: number) { const d = new Date(); d.setMonth(d.getMonth() - months); return isoDay(d); }
function todayIso() { return isoDay(new Date()); }
function yearStartIso() { return `${new Date().getFullYear()}-01-01`; }

type Preset = '3mo' | '6mo' | '12mo' | 'YTD';

function presetRange(p: Preset): { from: string; to: string } {
  const to = todayIso();
  if (p === 'YTD') return { from: yearStartIso(), to };
  const months = p === '3mo' ? 3 : p === '6mo' ? 6 : 12;
  return { from: monthsAgo(months), to };
}

function ProfitabilitySection({ customerId }: { customerId: string }) {
  const [preset, setPreset] = useState<Preset>('12mo');
  const [data, setData] = useState<CustomerProfitability | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    const range = presetRange(preset);
    getCustomerProfitability(customerId, range)
      .then(setData)
      .catch((err) => console.warn('Profitability load failed:', err.message))
      .finally(() => setLoading(false));
  }, [customerId, preset]);

  const presets: Preset[] = ['3mo', '6mo', '12mo', 'YTD'];

  return (
    <View style={profitStyles.container}>
      <Text style={profitStyles.header}>Profitability</Text>

      <View style={profitStyles.presetRow}>
        {presets.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPreset(p)}
            style={[profitStyles.presetChip, preset === p && profitStyles.presetChipActive]}
          >
            <Text style={[profitStyles.presetText, preset === p && profitStyles.presetTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.forest} style={{ marginVertical: 16 }} />
      ) : !data ? (
        <Text style={profitStyles.emptyText}>No profitability data.</Text>
      ) : (
        <>
          <View style={profitStyles.grid}>
            <View style={profitStyles.metric}>
              <Text style={profitStyles.metricLabel}>Revenue</Text>
              <Text style={profitStyles.metricValue}>{USD_FMT.format(data.revenue?.invoiced || 0)}</Text>
              <Text style={profitStyles.metricSub}>{USD_FMT.format(data.revenue?.paid || 0)} paid</Text>
            </View>
            <View style={profitStyles.metric}>
              <Text style={profitStyles.metricLabel}>Commission</Text>
              <Text style={profitStyles.metricValue}>
                {USD_FMT.format(data.commissionRevenue?.accrued || 0)}
              </Text>
              <Text style={profitStyles.metricSub}>FW/HH agent accrued</Text>
            </View>
            <View style={profitStyles.metric}>
              <Text style={profitStyles.metricLabel}>Total Net Profit</Text>
              <Text style={[profitStyles.metricValue, (data.totalNetProfit ?? data.netProfit ?? 0) < 0 && { color: COLORS.error }]}>
                {USD_FMT.format(data.totalNetProfit ?? data.netProfit ?? 0)}
              </Text>
              <Text style={profitStyles.metricSub}>Gross + comm − unreimb − overhead</Text>
            </View>
            <View style={profitStyles.metric}>
              <Text style={profitStyles.metricLabel}>Direct Cost Ratio</Text>
              <Text style={profitStyles.metricValue}>
                {data.directCostRatio != null ? `${(data.directCostRatio * 100).toFixed(1)}%` : '—'}
              </Text>
              <Text style={profitStyles.metricSub}>Direct exp ÷ revenue</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={profitStyles.expandBtn}>
            <Text style={profitStyles.expandText}>{expanded ? 'Hide breakdown ▲' : 'Show breakdown ▼'}</Text>
          </TouchableOpacity>

          {expanded ? (
            <View style={profitStyles.breakdown}>
              <BreakdownLine label="Revenue (invoiced)" value={USD_FMT.format(data.revenue?.invoiced || 0)} />
              <BreakdownLine label="COGS" value={USD_FMT.format(data.cogs || 0)} sign="−" />
              <BreakdownLine label="Gross Profit" value={USD_FMT.format(data.grossProfit || 0)} emphasis />
              <BreakdownLine
                label={`Commission Revenue (${data.commissionRevenue?.count || 0})`}
                sub="FW/HH accrued in period"
                value={USD_FMT.format(data.commissionRevenue?.accrued || 0)}
                sign="+"
              />
              <BreakdownLine
                label={`Direct Expenses (${data.directExpenses?.count || 0})`}
                value={USD_FMT.format(data.directExpenses?.total || 0)}
                sign="−"
              />
              <BreakdownLine
                label={`Reimbursements (${data.reimbursementsReceived?.count || 0})`}
                sub="Expense rows paid back by factory"
                value={USD_FMT.format(data.reimbursementsReceived?.total || 0)}
                sign="+"
              />
              <BreakdownLine
                label="Allocated Overhead"
                sub={data.allocatedOverhead?.revenueShare != null
                  ? `${(data.allocatedOverhead.revenueShare * 100).toFixed(2)}% of pool`
                  : undefined}
                value={USD_FMT.format(data.allocatedOverhead?.total || 0)}
                sign="−"
              />
              <BreakdownLine
                label="Net Commission Profit"
                sub="Commission − unreimbursed exp"
                value={USD_FMT.format(data.netCommissionProfit ?? 0)}
              />
              <BreakdownLine
                label="Total Net Profit"
                value={USD_FMT.format(data.totalNetProfit ?? data.netProfit ?? 0)}
                emphasis
              />
              <Text style={profitStyles.footnote}>
                Period {data.period?.from} to {data.period?.to}. USD basis. FW/HH agent model:
                buyer FOB already includes 7% commission, so gross margin is $0 and the income lands
                in CommissionTracking. Reimbursements close the loop on expenses the factory paid back.
              </Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function BreakdownLine({
  label, value, sign = '', emphasis = false, sub,
}: { label: string; value: string; sign?: string; emphasis?: boolean; sub?: string }) {
  return (
    <View style={[profitStyles.breakdownRow, emphasis && profitStyles.breakdownRowEmphasis]}>
      <View style={{ flex: 1 }}>
        <Text style={[profitStyles.breakdownLabel, emphasis && profitStyles.breakdownLabelEmphasis]}>{label}</Text>
        {sub ? <Text style={profitStyles.breakdownSub}>{sub}</Text> : null}
      </View>
      <Text style={[profitStyles.breakdownValue, emphasis && profitStyles.breakdownLabelEmphasis]}>
        {sign ? `${sign} ` : ''}{value}
      </Text>
    </View>
  );
}

// ─── Customer Row ─────────────────────────────────────────────────────────

const CustomerRow = memo(function CustomerRow({ customer, onPress }: { customer: Customer; onPress: () => void }) {
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={styles.name}>{displayName}</Text>
          {/* Phase 4, C18: sanctions warning indicator. Only renders for
              non-cleared / non-pending so a clean directory isn't visually
              cluttered. */}
          {(customer as any).screeningStatus === 'flagged' && (
            <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#991B1B', letterSpacing: 0.5 }}>SANCTIONS</Text>
            </View>
          )}
          {(customer as any).screeningStatus === 'override' && (
            <View style={{ backgroundColor: '#FFEDD5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#9A3412', letterSpacing: 0.5 }}>OVERRIDE</Text>
            </View>
          )}
          {(customer as any).screeningStatus === 'requires_review' && (
            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400E', letterSpacing: 0.5 }}>REVIEW</Text>
            </View>
          )}
        </View>
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
});

// ─── Customer Detail Modal ────────────────────────────────────────────────

function CustomerDetailModal({
  customerId,
  onClose,
  onDeleted,
}: {
  customerId: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);

  const {
    accessibleBrands,
    isCrossBrand: isCrossBrandUser,
    getBrand,
  } = useBrands();

  useEffect(() => {
    getCustomer(customerId)
      .then(setCustomer)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customerId]);

  function confirmDelete() {
    if (!customer) return;
    const name = customer.companyName ?? customer.name ?? 'this customer';
    Alert.alert(
      'Delete customer',
      `Delete ${name}? This cannot be undone from the mobile app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteCustomer(customerId);
              onDeleted(customerId);
              onClose();
            } catch (err: any) {
              Alert.alert('Could not delete', err.message ?? 'Server error');
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

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

  // Phase 1 Commit 5: brand-context tab strip. If the customer relates to
  // more than one brand the user can see (or the user is super_admin),
  // surface the SH activity / FW activity / All Brands switcher to match
  // the desktop ERP layout.
  const customerBrands = (Array.isArray(customer?.brandRelationships) && customer.brandRelationships.length
    ? customer.brandRelationships
    : ['SH']);
  const visibleBrands = customerBrands.filter((b) => accessibleBrands.includes(b));
  const canSeeAllBrands = isCrossBrandUser || accessibleBrands.length > 1;
  const showBrandTabs = visibleBrands.length > 1 || canSeeAllBrands;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {loading ? 'Loading…' : (customer?.companyName ?? customer?.name ?? 'Customer')}
          </Text>
          {customer && !loading ? (
            <TouchableOpacity
              onPress={confirmDelete}
              style={styles.headerIconBtn}
              disabled={deleting}
              hitSlop={8}
            >
              <Text style={styles.headerIconText}>{deleting ? '…' : '🗑'}</Text>
            </TouchableOpacity>
          ) : null}
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

            {/* Brand badges — Phase 1 Commit 5 */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <BrandBadgeGroup codes={customerBrands} size="md" />
            </View>

            {/* Brand-context tab strip */}
            {showBrandTabs ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 12,
                  padding: 8,
                  backgroundColor: activeBrand === 'all-brands' ? '#fef3c7' : '#f8fafc',
                  borderWidth: activeBrand === 'all-brands' ? 2 : 1,
                  borderStyle: activeBrand === 'all-brands' ? 'dashed' : 'solid',
                  borderColor: activeBrand === 'all-brands' ? '#92400e' : '#e2e8f0',
                  borderRadius: 4,
                }}
              >
                {visibleBrands.map((bc) => {
                  const b = getBrand(bc);
                  const isActive = (activeBrand ?? visibleBrands[0]) === bc;
                  return (
                    <TouchableOpacity
                      key={bc}
                      onPress={() => setActiveBrand(bc)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 4,
                        backgroundColor: isActive ? (b?.primaryColor ?? '#1D5A32') : 'transparent',
                        borderWidth: isActive ? 0 : 1,
                        borderColor: '#cbd5e1',
                      }}
                    >
                      <Text style={{
                        color: isActive ? (b?.accentColor ?? '#fff') : '#475569',
                        fontWeight: '600',
                        fontSize: 12,
                      }}>
                        {bc} activity
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {canSeeAllBrands ? (
                  <TouchableOpacity
                    onPress={() => setActiveBrand('all-brands')}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 4,
                      backgroundColor: activeBrand === 'all-brands' ? '#92400e' : 'transparent',
                      borderWidth: activeBrand === 'all-brands' ? 0 : 1,
                      borderStyle: 'dashed',
                      borderColor: '#92400e',
                    }}
                  >
                    <Text style={{
                      color: activeBrand === 'all-brands' ? '#fef3c7' : '#92400e',
                      fontWeight: '600',
                      fontSize: 12,
                    }}>
                      All Brands (read-only)
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Phase 3, C12: FW productBrandingMode picker (FW customers only) */}
            {customerBrands.includes('FW') ? (
              <ProductBrandingModePicker
                customer={customer}
                onSaved={(updated) => setCustomer(updated)}
              />
            ) : null}

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

            <ProfitabilitySection customerId={customer.id} />

            <ContactsSection parentType="Customer" parentId={customer.id} />

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await getCustomers({ page: 1 });
      setCustomers(res.data);
    } catch (err: any) {
      console.error('Customers load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Phase 4.5, C22: derived filter via useMemo (no double render).
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.companyName ?? c.name ?? '').toLowerCase().includes(q) ||
        (c.contactPerson ?? '').toLowerCase().includes(q) ||
        (c.country ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    );
  }, [search, customers]);

  // Phase 4.5, C22: stable renderItem + keyExtractor for memoized rows.
  const renderItem = useCallback(({ item }: { item: Customer }) => (
    <CustomerRow customer={item} onPress={() => setSelectedId(item.id)} />
  ), []);
  const keyExtractor = useCallback((item: Customer) => item.id, []);

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

      {/* List — Phase 4.5, C22 virtualization tuning */}
      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={10}
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
        <CustomerDetailModal
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={(id) => setCustomers((prev) => prev.filter((c) => c.id !== id))}
        />
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
  headerIconBtn: { marginLeft: 8, padding: 4 },
  headerIconText:{ color: COLORS.white, fontSize: 18 },
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

const profitStyles = StyleSheet.create({
  container: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  header: { fontSize: 15, fontWeight: '700', color: COLORS.ink, marginBottom: 12 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border,
  },
  presetChipActive: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  presetText: { fontSize: 12, color: COLORS.ink, fontWeight: '600' },
  presetTextActive: { color: COLORS.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: {
    width: '48.5%',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 12,
  },
  metricLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 17, color: COLORS.ink, fontWeight: '700', marginTop: 4 },
  metricSub: { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  emptyText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', marginVertical: 16 },
  expandBtn: { paddingVertical: 12, alignItems: 'center' },
  expandText: { fontSize: 13, color: COLORS.forest, fontWeight: '600' },
  breakdown: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 12,
  },
  breakdownRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownRowEmphasis: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4 },
  breakdownLabel: { fontSize: 13, color: COLORS.ink },
  breakdownSub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  breakdownValue: { fontSize: 13, color: COLORS.ink, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  breakdownLabelEmphasis: { fontWeight: '700' },
  footnote: { fontSize: 10, color: COLORS.muted, marginTop: 8, lineHeight: 14 },
});
