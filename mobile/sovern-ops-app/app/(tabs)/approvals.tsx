// ─── Approvals Screen ─────────────────────────────────────────────────────
// Shows InternalApproval requests pending Alex's decision.
// Coordinators submit Quotations/PIs/SOs for review; Alex approves or rejects
// from this screen. Maps to /api/internal-approvals.

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import {
  getPendingApprovals, approveDocument, rejectDocument,
  getMyActivities, markActivityDone,
  type InternalApproval, type ScheduledActivity,
} from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

// Discriminated union — the Approvals tab merges two backend sources:
// 1. InternalApproval — manager-approval requests raised by coordinators
//    (e.g. "approve sending this quotation"). Acted on with approve/reject.
// 2. ScheduledActivity (type='approve') — AI-generated approve tasks
//    created by the assistant when proposing new products / quotations.
//    Acted on with mark-done.
type AnyApproval =
  | { kind: 'internal'; data: InternalApproval }
  | { kind: 'activity'; data: ScheduledActivity };

// Entity type → display label + icon
const ENTITY_META: Record<string, { label: string; icon: string }> = {
  Quotation:       { label: 'Quotation',        icon: '📄' },
  ProformaInvoice: { label: 'Proforma Invoice',  icon: '🧾' },
  SalesOrder:      { label: 'Sales Order',       icon: '📋' },
  PurchaseOrder:   { label: 'Purchase Order',    icon: '🏭' },
  PackingList:     { label: 'Packing List',      icon: '📦' },
};
const DEFAULT_META = { label: 'Document', icon: '📄' };

function requesterName(item: InternalApproval) {
  if (item.requester) {
    return `${item.requester.firstName} ${item.requester.lastName}`.trim();
  }
  return `User #${item.requesterId}`;
}

function InternalApprovalCard({
  item, onApprove, onReject,
}: {
  item: InternalApproval;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const meta = ENTITY_META[item.entityType] ?? DEFAULT_META;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.docIcon}>{meta.icon}</Text>
        <View style={styles.cardHeaderText}>
          <View style={styles.titleRow}>
            <Text style={styles.docTitle}>
              {meta.label} #{item.entityId}
            </Text>
            <View style={[styles.kindBadge, styles.kindBadgeManager]}>
              <Text style={styles.kindBadgeText}>Manager</Text>
            </View>
          </View>
          <Text style={styles.docSub}>
            Submitted by {requesterName(item)}
          </Text>
        </View>
      </View>

      {item.requestNote ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>"{item.requestNote}"</Text>
        </View>
      ) : null}

      <Text style={styles.docDate}>
        Received {new Date(item.createdAt).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => onReject(item.id)}
        >
          <Text style={styles.rejectBtnText}>✕ Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.approveBtn]}
          onPress={() => onApprove(item.id)}
        >
          <Text style={styles.approveBtnText}>✓ Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ActivityApprovalCard({
  item, onDone,
}: {
  item: ScheduledActivity;
  onDone: (id: string) => void;
}) {
  // ScheduledActivity has a free-form title + entityType/entityId. Use the
  // entity meta for the icon when entityType is known; otherwise fall back
  // to the AI sparkle (since these are AI-generated).
  const meta = (item.entityType && ENTITY_META[item.entityType]) || { label: '', icon: '✦' };
  const due = item.dueDate
    ? new Date(item.dueDate).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.docIcon}>{meta.icon}</Text>
        <View style={styles.cardHeaderText}>
          <View style={styles.titleRow}>
            <Text style={styles.docTitle} numberOfLines={2}>{item.title}</Text>
            <View style={[styles.kindBadge, styles.kindBadgeAI]}>
              <Text style={styles.kindBadgeText}>AI</Text>
            </View>
          </View>
          {item.entityType && item.entityId ? (
            <Text style={styles.docSub}>
              {meta.label || item.entityType} #{item.entityId}
            </Text>
          ) : null}
        </View>
      </View>

      {item.body ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{item.body}</Text>
        </View>
      ) : null}

      <Text style={styles.docDate}>
        {due ? `Due ${due}` : `Created ${new Date(item.createdAt).toLocaleDateString()}`}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.approveBtn, { flex: 1 }]}
          onPress={() => onDone(item.id)}
        >
          <Text style={styles.approveBtnText}>✓ Mark done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ApprovalsScreen() {
  const [items, setItems]           = useState<AnyApproval[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: number } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      // Fetch both sources in parallel — same pattern as desktop
      // PendingApprovalsWidget. If either fails, fall through with the
      // partial data; mobile shouldn't go blank just because one source
      // glitched.
      const [internalRes, activitiesRes] = await Promise.allSettled([
        getPendingApprovals(),
        getMyActivities(),
      ]);

      const internal: AnyApproval[] = internalRes.status === 'fulfilled'
        ? internalRes.value.map((a) => ({ kind: 'internal' as const, data: a }))
        : [];

      const activities: AnyApproval[] = activitiesRes.status === 'fulfilled'
        ? activitiesRes.value
            .filter((a) => a.type === 'approve' && a.status === 'pending')
            .map((a) => ({ kind: 'activity' as const, data: a }))
        : [];

      // Merge sorted by most-recently-created first. Different shapes use
      // different timestamps; both have createdAt, so that's the common key.
      const merged = [...internal, ...activities].sort((a, b) => {
        const ta = new Date(a.data.createdAt).getTime();
        const tb = new Date(b.data.createdAt).getTime();
        return tb - ta;
      });
      setItems(merged);
    } catch (err: any) {
      console.error('[Approvals]', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: number) {
    Alert.alert(
      'Approve',
      'Confirm approval? The coordinator will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await approveDocument(id);
              setItems((prev) => prev.filter((i) =>
                !(i.kind === 'internal' && i.data.id === id)
              ));
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  async function handleMarkActivityDone(activityId: string) {
    Alert.alert(
      'Mark as done',
      'Mark this approval task as done? It will be removed from your queue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Done',
          onPress: async () => {
            try {
              await markActivityDone(activityId);
              setItems((prev) => prev.filter((i) =>
                !(i.kind === 'activity' && i.data.id === activityId)
              ));
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  async function handleRejectSubmit() {
    if (!rejectModal) return;
    if (!rejectNote.trim()) {
      Alert.alert('Required', 'Add a note explaining why this is rejected.');
      return;
    }
    setSubmitting(true);
    try {
      await rejectDocument(rejectModal.id, rejectNote.trim());
      setItems((prev) => prev.filter((i) =>
        !(i.kind === 'internal' && i.data.id === rejectModal.id)
      ));
      setRejectModal(null);
      setRejectNote('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {items.length > 0 && (
        <View style={styles.countBanner}>
          <Text style={styles.countText}>
            {items.length} item{items.length !== 1 ? 's' : ''} awaiting your decision
          </Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) =>
          item.kind === 'internal'
            ? `internal-${item.data.id}`
            : `activity-${item.data.id}`
        }
        renderItem={({ item }) =>
          item.kind === 'internal' ? (
            <InternalApprovalCard
              item={item.data}
              onApprove={handleApprove}
              onReject={(id) => setRejectModal({ id })}
            />
          ) : (
            <ActivityApprovalCard
              item={item.data}
              onDone={handleMarkActivityDone}
            />
          )
        }
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={COLORS.forest}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptyText}>No pending approvals.</Text>
          </View>
        )}
      />

      {/* Reject modal — requires a note */}
      <Modal
        visible={!!rejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Reject & send back</Text>
            <Text style={styles.modalSub}>
              Describe what needs to change before resubmission:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
              numberOfLines={4}
              placeholder="e.g. Unit price does not match agreed rate..."
              placeholderTextColor={COLORS.muted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setRejectModal(null); setRejectNote(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, submitting && { opacity: 0.6 }]}
                onPress={handleRejectSubmit}
                disabled={submitting}
              >
                <Text style={styles.modalSubmitText}>
                  {submitting ? 'Sending...' : 'Send rejection'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.cream },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },
  countBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  countText: { color: '#92400E', fontWeight: '600', fontSize: 13 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  docIcon:        { fontSize: 28 },
  cardHeaderText: { flex: 1 },
  titleRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  docTitle:       { fontSize: 15, fontWeight: '700', color: COLORS.ink, flexShrink: 1 },
  docSub:         { fontSize: 13, color: COLORS.muted, marginTop: 2 },

  // Source-of-approval badge — shown next to the title to disambiguate
  // manager-raised approvals from AI-generated approve tasks.
  kindBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kindBadgeManager: { backgroundColor: COLORS.forest + '22' },
  kindBadgeAI:      { backgroundColor: COLORS.statusProposal + '22' },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: 0.5,
  },
  noteBox: {
    backgroundColor: '#F9FAFB',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.forest,
    borderRadius: 4,
    padding: 10,
    marginTop: 10,
  },
  noteText: { fontSize: 13, color: COLORS.ink, fontStyle: 'italic' },
  docDate:  { fontSize: 12, color: COLORS.muted, marginTop: 10 },
  actions:  { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectBtn:     { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  rejectBtnText: { color: COLORS.error, fontWeight: '600', fontSize: 14 },
  approveBtn:     { backgroundColor: COLORS.forest },
  approveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptyText:  { fontSize: 14, color: COLORS.muted },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  modalSub:   { fontSize: 13, color: COLORS.muted },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.ink,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    backgroundColor: COLORS.cream, borderRadius: 8,
  },
  modalCancelText: { color: COLORS.muted, fontWeight: '600' },
  modalSubmit: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    backgroundColor: COLORS.error, borderRadius: 8,
  },
  modalSubmitText: { color: COLORS.white, fontWeight: '700' },
});
