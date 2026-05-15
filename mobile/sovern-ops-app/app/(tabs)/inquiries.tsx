// ─── Inquiries Screen ────────────────────────────────────────────────────
// RFQs landing in /api/inquiries. Triage from the road: read, see priority,
// see source (web/email/phone/portal), bump status as the funnel moves
// new → in_review → quoted → follow_up → converted/lost.
// Phase 4.6 part 5: InquiryRow memo + stable renderItem/keyExtractor.
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView, Alert, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  getInquiries, getInquiry, updateInquiryStatus, deleteInquiry,
  convertInquiryToQuotation, type Inquiry,
} from '../../src/services/api'
import { COLORS } from '../../src/constants/config'

const STATUS_FILTERS = [
  { key: '',           label: 'All' },
  { key: 'new',        label: 'New' },
  { key: 'in_review',  label: 'In Review' },
  { key: 'quoted',     label: 'Quoted' },
  { key: 'follow_up',  label: 'Follow-up' },
  { key: 'converted',  label: 'Converted' },
  { key: 'lost',       label: 'Lost' },
] as const

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  new:        { bg: '#DBEAFE', fg: '#1E40AF' },
  in_review:  { bg: '#FEF3C7', fg: '#92400E' },
  quoted:     { bg: '#DDD6FE', fg: '#5B21B6' },
  follow_up:  { bg: '#FEE2E2', fg: '#991B1B' },
  converted:  { bg: '#DCFCE7', fg: '#166534' },
  lost:       { bg: '#F3F4F6', fg: '#6B7280' },
  cancelled:  { bg: '#F3F4F6', fg: '#6B7280' },
}

const PRIORITY_COLORS: Record<string, string> = {
  low:    '#9CA3AF',
  medium: '#6B7280',
  high:   '#F59E0B',
  urgent: '#DC2626',
}

const SOURCE_ICON: Record<string, string> = {
  web:    '🌐',
  email:  '✉️',
  phone:  '📞',
  portal: '🏢',
}

const NEXT_STATUS: Record<string, { label: string; next: string }[]> = {
  new:       [{ label: 'Mark in review', next: 'in_review' }, { label: 'Mark lost', next: 'lost' }],
  in_review: [{ label: 'Mark quoted',     next: 'quoted' },    { label: 'Mark lost', next: 'lost' }],
  quoted:    [{ label: 'Mark follow-up',  next: 'follow_up' }, { label: 'Mark converted', next: 'converted' }, { label: 'Mark lost', next: 'lost' }],
  follow_up: [{ label: 'Mark converted',  next: 'converted' }, { label: 'Mark lost', next: 'lost' }],
}

function fmtDate(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Taipei' })
}

function fmtMoney(amount?: number, currency = 'USD') {
  if (amount == null) return null
  return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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

function PriorityDot({ priority }: { priority?: string }) {
  if (!priority || priority === 'low') return null
  return (
    <View
      style={[
        styles.priorityDot,
        { backgroundColor: PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium },
      ]}
    />
  )
}

const InquiryRow = memo(function InquiryRow({ inquiry, onPress }: { inquiry: Inquiry; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowHeader}>
        <View style={styles.rowHeaderLeft}>
          <Text style={styles.sourceIcon}>{SOURCE_ICON[inquiry.source ?? 'email'] ?? '✉️'}</Text>
          <Text style={styles.inqNumber}>{inquiry.inquiryNumber}</Text>
          <PriorityDot priority={inquiry.priority} />
        </View>
        <StatusBadge status={inquiry.status} />
      </View>
      {inquiry.customer?.companyName ? (
        <Text style={styles.customer} numberOfLines={1}>{inquiry.customer.companyName}</Text>
      ) : null}
      {inquiry.customer?.country ? (
        <Text style={styles.meta}>{inquiry.customer.country}</Text>
      ) : null}
      {inquiry.estimatedValue != null ? (
        <Text style={styles.value}>Est. {fmtMoney(inquiry.estimatedValue)}</Text>
      ) : null}
      {inquiry.followUpDate ? (
        <Text style={styles.followUp}>Follow-up {fmtDate(inquiry.followUpDate)}</Text>
      ) : null}
    </TouchableOpacity>
  )
})

function InquiryDetailModal({
  id,
  onClose,
  onChanged,
  onDeleted,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
  onDeleted: (id: string) => void
}) {
  const router = useRouter()
  const [item, setItem] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [converting, setConverting] = useState(false)

  useEffect(() => {
    getInquiry(id).then(setItem).catch(console.error).finally(() => setLoading(false))
  }, [id])

  function confirmConvert() {
    if (!item) return
    Alert.alert(
      'Convert to Quotation',
      `Generate a draft quotation from ${item.inquiryNumber}? You can edit pricing on the desktop ERP after conversion.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: async () => {
            setConverting(true)
            try {
              const quotation = await convertInquiryToQuotation(item.id)
              onChanged()
              onClose()
              // Navigate to the new quotation detail so the user can review
              // and continue editing on either surface.
              router.push(`/quotation/${quotation.id}`)
            } catch (err: any) {
              Alert.alert('Could not convert', err.message ?? 'Server error')
              setConverting(false)
            }
          },
        },
      ],
    )
  }

  function confirmDelete() {
    if (!item) return
    Alert.alert(
      'Delete inquiry',
      `Delete ${item.inquiryNumber}? This cannot be undone from the mobile app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await deleteInquiry(item.id)
              onDeleted(item.id)
              onClose()
            } catch (err: any) {
              // Backend blocks delete when inquiry was already converted to a
              // quotation — surface that message so it's actionable.
              Alert.alert('Could not delete', err.message ?? 'Server error')
              setDeleting(false)
            }
          },
        },
      ],
    )
  }

  async function bumpStatus(next: string, label: string) {
    if (!item) return
    Alert.alert(label, `Move ${item.inquiryNumber} → ${next.replace(/_/g, ' ')}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setUpdating(true)
          try {
            const updated = await updateInquiryStatus(item.id, next)
            setItem(updated)
            onChanged()
          } catch (err: any) {
            Alert.alert('Update failed', err.message ?? 'Try again.')
          } finally {
            setUpdating(false)
          }
        },
      },
    ])
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

  const transitions = item ? NEXT_STATUS[item.status] ?? [] : []

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={2}>
            {loading ? 'Loading…' : (item?.inquiryNumber ?? 'Inquiry')}
          </Text>
          {item && !loading ? (
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
        ) : item ? (
          <ScrollView contentContainerStyle={styles.detailScroll}>
            <View style={{ marginBottom: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <StatusBadge status={item.status} />
              {item.priority && item.priority !== 'medium' ? (
                <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority] }]}>
                  <Text style={styles.priorityBadgeText}>{item.priority.toUpperCase()}</Text>
                </View>
              ) : null}
            </View>
            {row('Customer', item.customer?.companyName)}
            {row('Country', item.customer?.country)}
            {row('Source', item.source ? `${SOURCE_ICON[item.source] ?? ''} ${item.source}` : null)}
            {row('Estimated Value', fmtMoney(item.estimatedValue))}
            {row('Follow-up', fmtDate(item.followUpDate))}
            {row('Sales Rep', item.salesPerson ? `${item.salesPerson.firstName} ${item.salesPerson.lastName}` : null)}
            {row('Created', fmtDate(item.createdAt))}
            {item.notes ? (
              <View style={styles.descBox}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.descText}>{item.notes}</Text>
              </View>
            ) : null}
            {/* Convert to Quotation — primary action when the inquiry has not
                yet been converted and is in a status where conversion makes
                sense. Backend allows conversion from any status; mobile hides
                the action once an inquiry already has convertedToQuotationId
                or is terminal (lost/cancelled). */}
            {!item.convertedToQuotationId
              && item.status !== 'lost'
              && item.status !== 'cancelled'
              && item.status !== 'converted' ? (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.actionsLabel}>Quotation</Text>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary, converting && styles.btnDisabled]}
                  onPress={confirmConvert}
                  disabled={converting}
                >
                  <Text style={styles.actionBtnText}>
                    {converting ? 'Converting…' : '→ Convert to Quotation'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {item.convertedToQuotationId ? (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.actionsLabel}>Quotation</Text>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnGhost]}
                  onPress={() => {
                    onClose()
                    router.push(`/quotation/${item.convertedToQuotationId}`)
                  }}
                >
                  <Text style={[styles.actionBtnText, styles.actionBtnGhostText]}>
                    View linked quotation
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {transitions.length > 0 ? (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.actionsLabel}>Update status</Text>
                {transitions.map((t) => (
                  <TouchableOpacity
                    key={t.next}
                    style={[styles.actionBtn, updating && styles.btnDisabled]}
                    onPress={() => bumpStatus(t.next, t.label)}
                    disabled={updating}
                  >
                    <Text style={styles.actionBtnText}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Inquiry not found.</Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

export default function InquiriesScreen() {
  const [items, setItems]           = useState<Inquiry[]>([])
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
      const res = await getInquiries({
        search: search || undefined,
        status: status || undefined,
        // Phase 4.8 Commit 3d — bumped from 50.
        limit: 200,
      })
      setItems(res.data ?? [])
    } catch (err: any) {
      console.error('[Inquiries]', err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [search, status])

  // Phase 4.6 part 5: stable refs for the memoized InquiryRow.
  const inqRenderItem = useCallback(({ item }: { item: Inquiry }) => (
    <InquiryRow inquiry={item} onPress={() => setSelectedId(item.id)} />
  ), [])
  const inqKeyExtractor = useCallback((s: Inquiry) => s.id, [])

  // Phase 4.8 Commit 3d — client-side sort-by-stage.
  const sortedItems = useMemo(() => {
    if (sortMode !== 'stage') return items
    const order: Record<string, number> = {
      new: 0, in_review: 1, quoted: 2, follow_up: 3, converted: 4, lost: 5,
    }
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
          placeholder="Search inquiry # or customer"
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
        keyExtractor={inqKeyExtractor}
        renderItem={inqRenderItem}
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
            <Text style={styles.emptyIcon}>📨</Text>
            <Text style={styles.emptyTitle}>No inquiries</Text>
            <Text style={styles.emptyText}>
              {search || status
                ? 'Try clearing filters.'
                : 'Inbound RFQs from web/email/phone/portal show up here.'}
            </Text>
          </View>
        )}
      />

      {selectedId ? (
        <InquiryDetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => load(true)}
          onDeleted={(id) => setItems((prev) => prev.filter((s) => s.id !== id))}
        />
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
  sortRow:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 8 },
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
  rowHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rowHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  sourceIcon:    { fontSize: 14 },
  inqNumber:     { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  priorityDot:   { width: 8, height: 8, borderRadius: 4 },
  customer:      { fontSize: 13, color: COLORS.ink, marginBottom: 2 },
  meta:          { fontSize: 12, color: COLORS.muted, marginBottom: 2 },
  value:         { fontSize: 13, color: COLORS.ink, fontWeight: '600' },
  followUp:      { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  statusBadge:     { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  priorityBadge:     { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4 },
  priorityBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },
  modalContainer: { flex: 1, backgroundColor: COLORS.cream },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.forest, paddingHorizontal: 16, paddingVertical: 14, paddingTop: 50,
  },
  modalTitle:    { color: COLORS.white, fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  headerIconBtn: { padding: 4, marginRight: 4 },
  headerIconText:{ color: COLORS.white, fontSize: 18 },
  closeBtn:      { padding: 4 },
  closeBtnText:  { color: COLORS.white, fontSize: 22 },
  detailScroll: { padding: 16, paddingBottom: 40 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailLabel:   { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  detailValue:   { fontSize: 13, color: COLORS.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  descBox:       { marginTop: 16, padding: 12, backgroundColor: COLORS.white, borderRadius: 8 },
  descText:      { fontSize: 13, color: COLORS.ink, marginTop: 6, lineHeight: 19 },
  actionsLabel:  { fontSize: 12, color: COLORS.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  actionBtn: {
    backgroundColor: COLORS.forest, padding: 12, borderRadius: 8,
    alignItems: 'center', marginBottom: 8,
  },
  actionBtnPrimary: { backgroundColor: COLORS.forest },
  actionBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.forest,
  },
  actionBtnGhostText: { color: COLORS.forest },
  actionBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  btnDisabled:   { opacity: 0.5 },
  empty: { paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptyText:  { fontSize: 13, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 40 },
})
