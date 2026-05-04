// ─── Inquiries Screen ────────────────────────────────────────────────────
// RFQs landing in /api/inquiries. Triage from the road: read, see priority,
// see source (web/email/phone/portal), bump status as the funnel moves
// new → in_review → quoted → follow_up → converted/lost.
import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView, Alert,
} from 'react-native'
import { getInquiries, getInquiry, updateInquiryStatus, type Inquiry } from '../../src/services/api'
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

function InquiryRow({ inquiry, onPress }: { inquiry: Inquiry; onPress: () => void }) {
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
}

function InquiryDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const [item, setItem] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    getInquiry(id).then(setItem).catch(console.error).finally(() => setLoading(false))
  }, [id])

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

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true)
      const res = await getInquiries({
        search: search || undefined,
        status: status || undefined,
        limit: 50,
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.forest} /></View>
  }

  return (
    <View style={styles.container}>
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
        data={items}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <InquiryRow inquiry={item} onPress={() => setSelectedId(item.id)} />
        )}
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
  actionsLabel:  { fontSize: 12, color: COLORS.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  actionBtn: {
    backgroundColor: COLORS.forest, padding: 12, borderRadius: 8,
    alignItems: 'center', marginBottom: 8,
  },
  actionBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  btnDisabled:   { opacity: 0.5 },
  empty: { paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptyText:  { fontSize: 13, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 40 },
})
