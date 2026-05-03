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
  type InternalApproval,
} from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

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

function ApprovalCard({
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
          <Text style={styles.docTitle}>
            {meta.label} #{item.entityId}
          </Text>
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

export default function ApprovalsScreen() {
  const [items, setItems]           = useState<InternalApproval[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: number } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const data = await getPendingApprovals();
      setItems(data);
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
              setItems((prev) => prev.filter((i) => i.id !== id));
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
      setItems((prev) => prev.filter((i) => i.id !== rejectModal.id));
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
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ApprovalCard
            item={item}
            onApprove={handleApprove}
            onReject={(id) => setRejectModal({ id })}
          />
        )}
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
  docTitle:       { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  docSub:         { fontSize: 13, color: COLORS.muted, marginTop: 2 },
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
