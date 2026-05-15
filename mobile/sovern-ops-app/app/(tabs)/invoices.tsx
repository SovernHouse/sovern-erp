// ─── Invoices Screen ─────────────────────────────────────────────────────
// Read-only money-flow visibility. Filter by paid/unpaid/overdue, search by
// invoice number, tap row for line-item detail.
// Phase 4.6 part 4: InvoiceRow memoized + stable renderItem/keyExtractor.
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView, Platform,
} from 'react-native'
import { getInvoices, getInvoice, type Invoice } from '../../src/services/api'
import { COLORS } from '../../src/constants/config'

const STATUS_FILTERS = [
  { key: '',         label: 'All' },
  { key: 'draft',    label: 'Draft' },
  { key: 'sent',     label: 'Sent' },
  { key: 'paid',     label: 'Paid' },
  { key: 'overdue',  label: 'Overdue' },
] as const

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft:     { bg: '#F3F4F6', fg: '#374151' },
  sent:      { bg: '#DBEAFE', fg: '#1E40AF' },
  paid:      { bg: '#DCFCE7', fg: '#166534' },
  overdue:   { bg: '#FEE2E2', fg: '#991B1B' },
  cancelled: { bg: '#F3F4F6', fg: '#6B7280' },
}

function fmtDate(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Taipei' })
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
      <Text style={[styles.statusBadgeText, { color: c.fg }]}>{status.toUpperCase()}</Text>
    </View>
  )
}

const InvoiceRow = memo(function InvoiceRow({ invoice, onPress }: { invoice: Invoice; onPress: () => void }) {
  const balance =
    invoice.totalAmount != null && invoice.paidAmount != null
      ? Number(invoice.totalAmount) - Number(invoice.paidAmount)
      : null
  const isOverdue =
    invoice.dueDate &&
    new Date(invoice.dueDate) < new Date() &&
    invoice.status !== 'paid' &&
    (balance == null || balance > 0)

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowHeader}>
        <Text style={styles.invNumber}>{invoice.invoiceNumber}</Text>
        <StatusBadge status={isOverdue ? 'overdue' : invoice.status} />
      </View>
      {invoice.customer?.companyName ? (
        <Text style={styles.customer} numberOfLines={1}>{invoice.customer.companyName}</Text>
      ) : null}
      <View style={styles.rowMetaRow}>
        {invoice.totalAmount != null ? (
          <Text style={styles.amount}>
            {fmtMoney(invoice.totalAmount, invoice.currency)}
          </Text>
        ) : null}
        {balance != null && balance > 0 ? (
          <Text style={[styles.amount, { color: COLORS.error }]}>
            · {fmtMoney(balance, invoice.currency)} due
          </Text>
        ) : null}
      </View>
      {invoice.dueDate ? (
        <Text style={[styles.due, isOverdue && { color: COLORS.error, fontWeight: '600' }]}>
          {isOverdue ? 'Overdue ' : 'Due '}
          {fmtDate(invoice.dueDate)}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
})

function InvoiceDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [item, setItem] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getInvoice(id).then(setItem).catch(console.error).finally(() => setLoading(false))
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
            {loading ? 'Loading…' : (item?.invoiceNumber ?? 'Invoice')}
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
            {row('Customer', item.customer?.companyName)}
            {row('Invoice Date', fmtDate(item.invoiceDate))}
            {row('Due Date', fmtDate(item.dueDate))}
            {row('Paid Date', fmtDate(item.paidDate))}
            {row('Total', fmtMoney(item.totalAmount, item.currency))}
            {row('Paid', fmtMoney(item.paidAmount, item.currency))}
            {item.totalAmount != null && item.paidAmount != null
              ? row('Balance', fmtMoney(Number(item.totalAmount) - Number(item.paidAmount), item.currency))
              : null}
            {item.notes ? (
              <View style={styles.descBox}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.descText}>{item.notes}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Invoice not found.</Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

export default function InvoicesScreen() {
  const [items, setItems]           = useState<Invoice[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Phase 4.8 Commit 3d — sort-by-stage default.
  const [sortMode, setSortMode] = useState<'stage' | 'recent'>('stage')

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true)
      const res = await getInvoices({
        search: search || undefined,
        status: status || undefined,
        // Phase 4.8 Commit 3d — bumped from 50.
        limit: 200,
      })
      setItems(res.data ?? [])
    } catch (err: any) {
      console.error('[Invoices]', err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [search, status])

  // Phase 4.6 part 4: stable refs for the memoized InvoiceRow.
  const invRenderItem = useCallback(({ item }: { item: Invoice }) => (
    <InvoiceRow invoice={item} onPress={() => setSelectedId(item.id)} />
  ), [])
  const invKeyExtractor = useCallback((s: Invoice) => s.id, [])

  // Phase 4.8 Commit 3d — client-side sort-by-stage.
  const sortedItems = useMemo(() => {
    if (sortMode !== 'stage') return items
    const order: Record<string, number> = { draft: 0, sent: 1, paid: 2, overdue: 3, cancelled: 4 }
    return [...items].sort((a, b) => {
      const oa = order[a.status] ?? 99
      const ob = order[b.status] ?? 99
      if (oa !== ob) return oa - ob
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return db - da
    })
  }, [items, sortMode])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.forest} /></View>
  }

  return (
    <View style={styles.container}>
      {/* Phase 4.8 Commit 3d — sort toggle */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        <TouchableOpacity style={[styles.sortPill, sortMode === 'stage' && styles.sortPillActive]} onPress={() => setSortMode('stage')}>
          <Text style={[styles.sortPillText, sortMode === 'stage' && styles.sortPillTextActive]}>By stage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sortPill, sortMode === 'recent' && styles.sortPillActive]} onPress={() => setSortMode('recent')}>
          <Text style={[styles.sortPillText, sortMode === 'recent' && styles.sortPillTextActive]}>Recent</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search invoice #"
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
        data={sortedItems}
        keyExtractor={invKeyExtractor}
        renderItem={invRenderItem}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={10}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />
        }
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyTitle}>No invoices</Text>
            <Text style={styles.emptyText}>
              {search || status
                ? 'Try clearing filters.'
                : 'No invoices yet. New invoices appear here once issued from the desktop ERP.'}
            </Text>
          </View>
        )}
      />

      {selectedId ? (
        <InvoiceDetailModal id={selectedId} onClose={() => setSelectedId(null)} />
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
  // Phase 4.8 Commit 3d — sort toggle row
  sortRow:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 8 },
  sortLabel:         { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  sortPill:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  sortPillActive:    { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  sortPillText:      { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  sortPillTextActive:{ color: COLORS.white },
  row: {
    backgroundColor: COLORS.white,
    borderRadius: 10, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  invNumber: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  customer:  { fontSize: 13, color: COLORS.ink, marginBottom: 4 },
  rowMetaRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  amount:    { fontSize: 13, color: COLORS.ink, fontWeight: '600' },
  due:       { fontSize: 12, color: COLORS.muted, marginTop: 2 },
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
