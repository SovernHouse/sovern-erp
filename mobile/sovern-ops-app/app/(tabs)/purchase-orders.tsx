// ─── Purchase Orders Screen ──────────────────────────────────────────────
// Read-only visibility into outbound POs to suppliers/factories. Useful in
// the field when chatting with a supplier on WhatsApp and needing a quick
// PO status check.
// Phase 4.6 part 4: PORow memoized + stable renderItem/keyExtractor +
// virtualization tuning.
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView, Alert, Share, Linking, Platform,
} from 'react-native'
import {
  getPurchaseOrders, getPurchaseOrder, generateApprovalLink,
  type PurchaseOrder,
} from '../../src/services/api'
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Taipei' })
}

function fmtDateTime(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Taipei' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Taipei' })
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

const PORow = memo(function PORow({ po, onPress }: { po: PurchaseOrder; onPress: () => void }) {
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
})

function PODetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [item, setItem] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingLink, setGeneratingLink] = useState(false)

  useEffect(() => {
    getPurchaseOrder(id).then(setItem).catch(console.error).finally(() => setLoading(false))
  }, [id])

  async function handleSendForSignature() {
    if (!item || generatingLink) return
    setGeneratingLink(true)
    try {
      const link = await generateApprovalLink('PurchaseOrder', item.id)
      Alert.alert(
        'Signature link ready',
        `${link.documentLabel}\n\nThe link expires on ${new Date(link.expiresAt).toLocaleDateString('en-US', { timeZone: 'Asia/Taipei' })}. Tap Share to send it to the supplier.`,
        [
          { text: 'Done', style: 'cancel' },
          { text: 'Open', onPress: () => Linking.openURL(link.approvalUrl) },
          {
            text: 'Share',
            onPress: () =>
              Share.share({
                message: `Please confirm purchase order ${link.documentLabel}: ${link.approvalUrl}`,
                url: link.approvalUrl,
              }),
          },
        ],
      )
    } catch (err: any) {
      Alert.alert('Could not generate link', err.message ?? 'Server error')
    } finally {
      setGeneratingLink(false)
    }
  }

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

            {/* Send for signature — hidden once already signed/cancelled */}
            {!item.signedAt && item.status !== 'cancelled' ? (
              <TouchableOpacity
                style={[styles.signActionBtn, generatingLink && styles.signActionBtnDisabled]}
                onPress={handleSendForSignature}
                disabled={generatingLink}
                activeOpacity={0.7}
              >
                <Text style={styles.signActionIcon}>✉️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.signActionLabel}>
                    {generatingLink ? 'Generating link…' : 'Send for supplier signature'}
                  </Text>
                  <Text style={styles.signActionMeta}>
                    Public approve link the supplier can confirm without logging in
                  </Text>
                </View>
                <Text style={styles.signActionChevron}>›</Text>
              </TouchableOpacity>
            ) : null}

            {/* Supplier acceptance — only shown when the supplier has signed */}
            {item.signedAt && item.signedBySupplier ? (
              <View style={styles.signedCard}>
                <View style={styles.signedIcon}>
                  <Text style={styles.signedIconText}>✓</Text>
                </View>
                <View style={styles.signedBody}>
                  <Text style={styles.signedHeadline}>
                    Confirmed by {item.signedBySupplier}
                  </Text>
                  <Text style={styles.signedMeta}>
                    {fmtDateTime(item.signedAt)}
                  </Text>
                </View>
              </View>
            ) : null}

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
  // Phase 4.8 Commit 3d — sort-by-stage default.
  const [sortMode, setSortMode] = useState<'stage' | 'recent'>('stage')

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true)
      const res = await getPurchaseOrders({
        search: search || undefined,
        status: status || undefined,
        // Phase 4.8 Commit 3d — bumped from 50.
        limit: 200,
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

  // Phase 4.6 part 4: stable refs for the memoized PORow.
  const poRenderItem = useCallback(({ item }: { item: PurchaseOrder }) => (
    <PORow po={item} onPress={() => setSelectedId(item.id)} />
  ), [])
  const poKeyExtractor = useCallback((p: PurchaseOrder) => p.id, [])

  // Phase 4.8 Commit 3d — client-side sort-by-stage so every status is
  // visible on open instead of only the newest cohort.
  const sortedItems = useMemo(() => {
    if (sortMode !== 'stage') return items
    const order: Record<string, number> = {
      draft: 0, sent: 1, confirmed: 2, in_production: 3, shipped: 4, received: 5,
    }
    return [...items].sort((a, b) => {
      const oa = order[a.status ?? ''] ?? 99
      const ob = order[b.status ?? ''] ?? 99
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
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search PO #"
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

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
        keyExtractor={poKeyExtractor}
        renderItem={poRenderItem}
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
  // Pill-contrast bugfix — darker border + text on inactive pills.
  filterPill: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 16, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.muted,
  },
  filterPillActive:    { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  filterPillText:      { fontSize: 12, color: COLORS.steel, fontWeight: '600' },
  filterPillTextActive:{ color: COLORS.white },
  // Phase 4.8 Commit 3d + pill-contrast bugfix — sort toggle row
  sortRow:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 8 },
  sortLabel:         { fontSize: 11, fontWeight: '700', color: COLORS.steel, textTransform: 'uppercase', letterSpacing: 0.6 },
  sortPill:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: COLORS.muted, backgroundColor: COLORS.white },
  sortPillActive:    { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  sortPillText:      { fontSize: 12, color: COLORS.steel, fontWeight: '600' },
  sortPillTextActive:{ color: COLORS.white },
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
  empty: { paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptyText:  { fontSize: 13, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 40 },

  // Send-for-signature CTA
  signActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.forest + '50',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  signActionBtnDisabled: { opacity: 0.5 },
  signActionIcon:     { fontSize: 20 },
  signActionLabel:    { fontSize: 14, fontWeight: '700', color: COLORS.forest },
  signActionMeta:     { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  signActionChevron:  { fontSize: 22, color: COLORS.muted, alignSelf: 'center' },
})
