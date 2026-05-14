// ─── Activities Screen ─────────────────────────────────────────────────────
// Shows overdue and upcoming activities Alex needs to act on.
// Maps to /api/activities/overdue and /api/activities/upcoming.
// One-tap to mark complete with an optional outcome note.

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import {
  getOverdueActivities, getUpcomingActivities, completeActivity,
  type Activity,
} from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

// ─── Display helpers ──────────────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: string; label: string }> = {
  call:      { icon: '📞', label: 'Call' },
  email:     { icon: '✉️',  label: 'Email' },
  meeting:   { icon: '🤝', label: 'Meeting' },
  note:      { icon: '📝', label: 'Note' },
  task:      { icon: '✅', label: 'Task' },
  follow_up: { icon: '🔄', label: 'Follow-up' },
};

const PRIORITY_COLORS: Record<string, string> = {
  high:   '#DC2626',
  medium: '#D97706',
  low:    '#6B7280',
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Taipei' });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ActivityRow({
  item,
  overdue,
  onComplete,
}: {
  item: Activity;
  overdue: boolean;
  onComplete: (id: string) => void;
}) {
  const meta = TYPE_META[item.type] ?? { icon: '📋', label: item.type };
  const priorityColor = PRIORITY_COLORS[item.priority] ?? COLORS.muted;

  return (
    <View style={[styles.row, overdue && styles.rowOverdue]}>
      <View style={styles.rowLeft}>
        <Text style={styles.typeIcon}>{meta.icon}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
        {item.lead ? (
          <Text style={styles.leadName} numberOfLines={1}>
            {item.lead.companyName}
          </Text>
        ) : null}
        <View style={styles.rowMeta}>
          <Text style={[styles.priority, { color: priorityColor }]}>
            {item.priority.toUpperCase()}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={[styles.date, overdue && styles.dateOverdue]}>
            {overdue ? `Due ${formatDate(item.scheduledAt)}` : formatDate(item.scheduledAt)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.completeBtn}
        onPress={() => onComplete(item.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.completeBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionHeader({ title, count, accent }: { title: string; count: number; accent?: string }) {
  return (
    <View style={[styles.sectionHeader, accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : null]}>
      <Text style={[styles.sectionTitle, accent ? { color: accent } : null]}>
        {title}
      </Text>
      <View style={[styles.badge, accent ? { backgroundColor: accent + '22' } : null]}>
        <Text style={[styles.badgeText, accent ? { color: accent } : null]}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ActivitiesScreen() {
  const [overdue, setOverdue]       = useState<Activity[]>([]);
  const [upcoming, setUpcoming]     = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doneModal, setDoneModal]   = useState<{ id: string } | null>(null);
  const [outcome, setOutcome]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const [ov, up] = await Promise.all([
        getOverdueActivities(),
        getUpcomingActivities(),
      ]);
      setOverdue(ov);
      setUpcoming(up);
    } catch (err: any) {
      console.error('[Activities]', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleComplete(id: string) {
    setDoneModal({ id });
    setOutcome('');
  }

  async function submitComplete() {
    if (!doneModal) return;
    setSubmitting(true);
    try {
      await completeActivity(doneModal.id, outcome.trim() || undefined);
      // Remove from both lists
      setOverdue((prev) => prev.filter((a) => a.id !== doneModal.id));
      setUpcoming((prev) => prev.filter((a) => a.id !== doneModal.id));
      setDoneModal(null);
      setOutcome('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const sections = [
    ...(overdue.length > 0
      ? [{ title: 'Overdue', data: overdue, overdue: true }]
      : []),
    ...(upcoming.length > 0
      ? [{ title: 'Upcoming', data: upcoming, overdue: false }]
      : []),
  ];

  const totalCount = overdue.length + upcoming.length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {overdue.length > 0 && (
        <View style={styles.overdueBar}>
          <Text style={styles.overdueBarText}>
            ⚠ {overdue.length} overdue activit{overdue.length !== 1 ? 'ies' : 'y'}
          </Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <SectionHeader
            title={section.title}
            count={section.data.length}
            accent={section.overdue ? COLORS.error : COLORS.forest}
          />
        )}
        renderItem={({ item, section }) => (
          <ActivityRow
            item={item}
            overdue={section.overdue}
            onComplete={handleComplete}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={COLORS.forest}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗓️</Text>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyText}>No overdue or upcoming activities.</Text>
          </View>
        )}
        contentContainerStyle={totalCount === 0 ? { flex: 1 } : { paddingBottom: 32 }}
        stickySectionHeadersEnabled
      />

      {/* Mark-done modal */}
      <Modal
        visible={!!doneModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDoneModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Mark as done</Text>
            <Text style={styles.modalSub}>
              Optional: add an outcome note for your records.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={outcome}
              onChangeText={setOutcome}
              placeholder="e.g. Left voicemail, will follow up Thursday..."
              placeholderTextColor={COLORS.muted}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setDoneModal(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, submitting && { opacity: 0.6 }]}
                onPress={submitComplete}
                disabled={submitting}
              >
                <Text style={styles.modalSubmitText}>
                  {submitting ? 'Saving...' : 'Mark done'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },

  overdueBar: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  overdueBarText: { color: COLORS.error, fontWeight: '600', fontSize: 13 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: COLORS.cream,
    borderLeftWidth: 0,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: COLORS.muted,
  },
  badge: {
    backgroundColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.muted },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  rowOverdue: { backgroundColor: '#FFF9F9' },
  rowLeft:   { width: 32, alignItems: 'center' },
  typeIcon:  { fontSize: 22 },
  rowBody:   { flex: 1 },
  subject:   { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  leadName:  { fontSize: 12, color: COLORS.forest, marginTop: 1 },
  rowMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  priority:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  dot:       { fontSize: 10, color: COLORS.muted },
  date:      { fontSize: 11, color: COLORS.muted },
  dateOverdue: { color: COLORS.error, fontWeight: '600' },

  completeBtn: {
    backgroundColor: COLORS.forest,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  completeBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 60 },

  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    minHeight: 80,
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
    backgroundColor: COLORS.forest, borderRadius: 8,
  },
  modalSubmitText: { color: COLORS.white, fontWeight: '700' },
});
