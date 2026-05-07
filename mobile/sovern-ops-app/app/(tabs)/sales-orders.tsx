// ─── Sales Orders Screen ─────────────────────────────────────────────────
// Confirmed customer orders. Read-only on mobile; create/edit happens on
// desktop. Detail modal shows the e-signature card when the customer has
// approved the SO via the public sign link (signedAt + signedByClient).
import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native'
import { getSalesOrders, getSalesOrder, type SalesOrder, type SalesOrderItem } from '../../src/services/api'
import { COLORS } from '../../src/constants/config'

const STATUS_FILTERS = [
  { key: '',           label: 'All' },
  { key: 'draft',      label: 'Draft' },
  { key: 'confirmed',  label: 'Confirmed' },
  { key: 'in_production', label: 'In Production' },
  { key: 'shipped',    label: 'Shipped' },
  { key: 'delivered',  label: 'Delivered' },
  { key: 'cancelled',  label: 'Cancelled' },
] as const

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft:         { bg: '#F3F4F6', fg: '#374151' },
  confirmed:     { bg: '#DBEAFE', fg: '#1E40AF' },
  in_production: { bg: '#FEF3C7', fg: '#92400E' },
  shipped:       { bg: '#DDD6FE', fg: '#5B21B6' },
  delivered:     { bg: '#DCFCE7', fg: '#166534' },
  cancelled:     { bg: '#FEE2E2', fg: '#991B1B' },
}

function fmtDate(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} at ${time}`
}

function fmtMoney(amount?: number, currency: string = 'USD') {
  if (amount == null) return null
  return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null
  const c = STATUS_COLORS[status] || { bg: '#F3F4F6', fg: '#374151' }
  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusBadgeText, { color: c.fg }]}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Text>
    </View>
  )
}

function SORow({ so, onPress }: { so: SalesOrder; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowHeader}>
        <Text style={styles.orderNumber}>{so.orderNumber}</Text>
        <StatusBadge status={so.status} />
      </View>
      {so.customer ? (
        <Text style={styles.customer} numberOfLines={1}>
          {so.customer.companyName}
        </Text>
      ) : null}
      {so.totalAmount != null ? (
        <Text style={styles.amount}>{fmtMoney(so.totalAmount, so.currency)}</Text>
      ) : null}
      {so.expectedDeliveryDate ? (
        <Text style={styles.eta}>
          Expected {fmtDate(so.expectedDeliveryDate)}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
}

function LineItemRow({ item, currency }: { item: SalesOrderItem; currency?: string }) {
  return (
    <View style={styles.lineItem}>
      <View style={styles.lineItemTop}>
        <Text style={styles.lineItemDesc} numberOfLines={2}>
          {item.description ?? item.product?.name ?? '—'}
        </Text>
        <Text style={styles.lineItemTotal}>
          {fmtMoney(item.total, currency)}
        </Text>
      </View>
      <Text style={styles.lineItemMeta}>
        {item.quantity} {item.unit ?? 'unit'} × {fmtMoney(item.unitPrice, currency)}
      </Text>
    </View>
  )
}

function SODetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [item, setItem] = useState<SalesOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSalesOrder(id)
      .then(setItem)
      .catch((err) => console.error('[SO/detail]', err.message))
      .finally(() => setLoading(false))
  }, [id])

  function row(label: string, value?: string | number | null) {
    if (value == null || value === '') return null
    return (
      <View style={styles.detailRow} key={label}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{String(value)}</Text>
      </View>
    )
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={2}>
            {loading ? 'Loading…' : (item?.orderNumber ?? 'Sales Order')}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.forest} />
        ) : item ? (
          <ScrollView contentContainerStyle={styles.detailScroll}>
            <View style={{ marginBottom: 12 }}>
              <StatusBadge status={item.status} />
            </View>

            {/* Customer acceptance — only shown when the customer has signed */}
            {item.signedAt && item.signedByClient ? (
              <View style={styles.signedCard}>
                <View style={styles.signedIcon}>
                  <Text style={styles.signedIconText}>✓</Text>
                </View>
                <View style={styles.signedBody}>
                  <Text style={styles.signedHeadline}>
                    Accepted by {item.signedByClient}
                  </Text>
                  <Text style={styles.signedMeta}>
                    {fmtDateTime(item.signedAt)}
                  </Text>
                </View>
              </View>
            ) : null}

            {row('Customer', item.customer?.companyName)}
            {row('Country', item.customer?.country)}
            {row('Factory', item.factory?.companyName)}
            {row('Total', fmtMoney(item.totalAmount, item.currency))}
            {row('Expected Delivery', fmtDate(item.expectedDeliveryDate))}
            {row('Actual Delivery', fmtDate(item.actualDeliveryDate))}
            {row('Payment Terms', item.paymentTerms)}
            {row('Shipping Terms', item.shippingTerms)}
            {row('Created', fmtDate(item.createdAt))}

            {item.items && item.items.length > 0 ? (
              <View style={styles.itemsBox}>
                <Text style={[styles.detailLabel, styles.itemsLabel]}>
                  Line Items ({item.items.length})
                </Text>
                {item.items.map((line, i) => (
                  <View key={line.id}>
                    <LineItemRow item={line} currency={item.currency} />
                    {i < (item.items?.length ?? 0) - 1
                      ? <View style={styles.itemDivider} /> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {item.notes ? (
              <View style={styles.descBox}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.descText}>{item.notes}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Sales order not found.</Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

export default function SalesOrdersScreen() {
  const [items, setItems]           = useState<SalesOrder[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true)
      const res = await getSalesOrders({
        search: search || undefined,
        status: status || undefined,
        limit: 50,
      })
      setItems(res.data ?? [])
    } catch (err: any) {
      console.error('[SO]', err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [search, status])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.forest} /></View>
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search SO #"
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => {
          const active = status === f.key
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setStatus(f.key)}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <SORow so={item} onPress={() => setSelectedId(item.id)} />
        )}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />
        }
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📑</Text>
            <Text style={styles.emptyTitle}>No sales orders</Text>
            <Text style={styles.emptyText}>
              {search || status
                ? 'Try clearing filters.'
                : 'Confirmed orders from quotations show up here.'}
            </Text>
          </View>
        )}
      />

      {selectedId ? (
        <SODetailModal id={selectedId} onClose={() => setSelectedId(null)} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },
  searchBar: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  searchInput: {
    backgroundColor: COLORS.cream,
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14,
    fontSize: 14, color: COLORS.ink,
  },
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 16, backgroundColor: COLORS.cream,
  },
  filterPillActive:    { backgroundColor: COLORS.forest },
  filterPillText:      { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  filterPillTextActive:{ color: COLORS.white },
  row: {
    backgroundColor: COLORS.white,
    borderRadius: 10, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  rowHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNumber: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  customer:    { fontSize: 13, color: COLORS.ink, marginBottom: 4 },
  amount:      { fontSize: 13, color: COLORS.ink, fontWeight: '600' },
  eta:         { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  statusBadge:     { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  modalContainer: { flex: 1, backgroundColor: COLORS.cream },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.forest, paddingHorizontal: 16, paddingVertical: 14, paddingTop: 50,
  },
  modalTitle:   { color: COLORS.white, fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  closeBtn:     { padding: 4 },
  closeBtnText: { color: COLORS.white, fontSize: 22 },
  detailScroll: { padding: 16, paddingBottom: 40 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailLabel:   { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  detailValue:   { fontSize: 13, color: COLORS.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  descBox:       { marginTop: 16, padding: 12, backgroundColor: COLORS.white, borderRadius: 8 },
  descText:      { fontSize: 13, color: COLORS.ink, marginTop: 6, lineHeight: 19 },

  // Items
  itemsBox:    { marginTop: 12, backgroundColor: COLORS.white, borderRadius: 10, overflow: 'hidden' },
  itemsLabel:  { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  lineItem:    { paddingHorizontal: 14, paddingVertical: 10 },
  lineItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 },
  lineItemDesc:  { flex: 1, fontSize: 13, color: COLORS.ink, fontWeight: '600' },
  lineItemTotal: { fontSize: 13, fontWeight: '700', color: COLORS.forest },
  lineItemMeta:  { fontSize: 11, color: COLORS.muted },
  itemDivider:   { height: 1, backgroundColor: COLORS.border, marginHorizontal: 14 },

  empty: { paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptyText:  { fontSize: 13, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 40 },

  // E-signature card
  signedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.success + '12',
    borderWidth: 1,
    borderColor: COLORS.success + '40',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  signedIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.success,
    justifyContent: 'center', alignItems: 'center',
  },
  signedIconText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  signedBody:     { flex: 1 },
  signedHeadline: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  signedMeta:     { fontSize: 12, color: COLORS.muted, marginTop: 2 },
})
