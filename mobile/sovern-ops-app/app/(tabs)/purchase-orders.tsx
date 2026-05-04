// ─── Purchase Orders Screen ──────────────────────────────────────────────
// Read-only visibility into outbound POs to suppliers/factories. Useful in
// the field when chatting with a supplier on WhatsApp and needing a quick
// PO status check.
import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native'
import { getPurchaseOrders, getPurchaseOrder, type PurchaseOrder } from '../../src/services/api'
import { COLORS } from '../../src/constants/config'

const STATUS_FILTERS = [
  { key: '',           label: 'All' },
  { key: 'draft',      label: 'Draft' },
  { key: 'sent',       label: 'Sent' },
  { key: 'confirmed',  label: 'Confirmed' },
  { key: 'in_production', label: 'In Production' },
  { key: 'shipped',    label: 'Shipped' },
  { key: 'received',   label: 'Received' },
] as const

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft:         { bg: '#F3F4F6', fg: '#374151' },
  sent:          { bg: '#DBEAFE', fg: '#1E40AF' },
  confirmed:     { bg: '#E0E7FF', fg: '#3730A3' },
  in_production: { bg: '#FEF3C7', fg: '#92400E' },
  shipped:       { bg: '#DDD6FE', fg: '#5B21B6' },
  received:      { bg: '#DCFCE7', fg: '#166534' },
  cancelled:     { bg: '#FEE2E2', fg: '#991B1B' },
}

function fmtDate(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

function PORow({ po, onPress }: { po: PurchaseOrder; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowHeader}>
        <Text style={styles.poNumber}>{po.poNumber}</Text>
        <StatusBadge status={po.status} />
      </View>
      {po.factory ? (
        <Text style={styles.factory} numberOfLines={1}>
          {po.factory.companyName || po.factory.name || 'Supplier'}
        </Text>
      ) : null}
      {po.totalAmount != null ? (
        <Text style={styles.amount}>{fmtMoney(po.totalAmount, po.currency)}</Text>
      ) : null}
      {po.expectedDeliveryDate ? (
        <Text style={styles.eta}>
          Expected {fmtDate(po.expectedDeliveryDate)}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
}

function PODetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [item, setItem] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPurchaseOrder(id).then(setItem).catch(console.error).finally(() => setLoading(false))
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
            {loading ? 'Loading…' : (item?.poNumber ?? 'PO')}
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
            {row('Supplier', item.factory?.companyName || item.factory?.name)}
            {row('Total', fmtMoney(item.totalAmount, item.currency))}
            {row('Expected Delivery', fmtDate(item.expectedDeliveryDate))}
            {row('Actual Delivery', fmtDate(item.actualDeliveryDate))}
            {row('Payment Terms', item.paymentTerms)}
            {row('Shipping Terms', item.shippingTerms)}
            {item.notes ? (
              <View style={styles.descBox}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.descText}>{item.notes}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>PO not found.</Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

export default function PurchaseOrdersScreen() {
  const [items, setItems]           = useState<PurchaseOrder[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true)
      const res = await getPurchaseOrders({
        search: search || undefined,
        status: status || undefined,
        limit: 50,
      })
      setItems(res.data ?? [])
    } catch (err: any) {
      console.error('[POs]', err.message)
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
          placeholder="Search PO #"
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
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PORow po={item} onPress={() => setSelectedId(item.id)} />
        )}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />
        }
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No purchase orders</Text>
            <Text style={styles.emptyText}>
              {search || status
                ? 'Try clearing filters.'
                : 'No POs yet. New POs created in the desktop ERP appear here.'}
            </Text>
          </View>
        )}
      />

      {selectedId ? (
        <PODetailModal id={selectedId} onClose={() => setSelectedId(null)} />
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
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  poNumber:  { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  factory:   { fontSize: 13, color: COLORS.ink, marginBottom: 4 },
  amount:    { fontSize: 13, color: COLORS.ink, fontWeight: '600' },
  eta:       { fontSize: 11, color: COLORS.muted, marginTop: 4 },
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
  empty: { paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptyText:  { fontSize: 13, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 40 },
})
