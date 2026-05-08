// ─── Dev Mode Runs Screen ─────────────────────────────────────────────────────
// Route: /dev-runs  (super_admin only — gated client-side AND server-side)
// Audit list of every dev-mode AI run with status, PR link, and detail drawer.
// Mirror of admin-portal DevRunsPage.jsx for mobile parity.

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  Alert, Pressable, TextInput, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  listDevModeRuns, getDevModeRun, answerDevModeClarification, abortDevModeRun,
  type DevModeRun, type DevModeRunStatus,
} from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';
import { COLORS } from '../src/constants/config';

const NON_TERMINAL: DevModeRunStatus[] = ['queued', 'running', 'opening_pr', 'awaiting_clarification'];

const STATUS_FILTERS: Array<{ value: DevModeRunStatus | ''; label: string }> = [
  { value: '',                       label: 'All' },
  { value: 'queued',                 label: 'Queued' },
  { value: 'running',                label: 'Running' },
  { value: 'awaiting_clarification', label: 'Awaiting' },
  { value: 'completed',              label: 'Completed' },
  { value: 'wip',                    label: 'WIP' },
  { value: 'failed',                 label: 'Failed' },
];

function statusLabel(s: DevModeRunStatus): string {
  switch (s) {
    case 'queued':                 return 'Queued';
    case 'running':                return 'Running';
    case 'opening_pr':             return 'Opening PR';
    case 'awaiting_clarification': return 'Awaiting answer';
    case 'completed':              return 'Completed';
    case 'wip':                    return 'WIP';
    case 'failed':                 return 'Failed';
    case 'aborted':                return 'Aborted';
    default:                       return s;
  }
}
function statusColor(s: DevModeRunStatus): string {
  switch (s) {
    case 'completed':              return '#059669';
    case 'wip':                    return '#d97706';
    case 'failed':                 return '#dc2626';
    case 'aborted':                return '#475569';
    case 'awaiting_clarification': return '#d97706';
    case 'opening_pr':             return '#7c3aed';
    case 'running':                return '#2563eb';
    default:                       return '#64748b';
  }
}

function relTime(iso?: string): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}

function StatusPill({ status }: { status: DevModeRunStatus }) {
  const color = statusColor(status);
  return (
    <View style={[styles.pill, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{statusLabel(status)}</Text>
    </View>
  );
}

export default function DevRunsScreen() {
  const { user } = useAuthStore();
  const isAuthorized = user?.role === 'super_admin';
  const router = useRouter();

  const [runs, setRuns] = useState<DevModeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DevModeRunStatus | ''>('');
  const [selected, setSelected] = useState<DevModeRun | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isAuthorized) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const params: { status?: DevModeRunStatus; limit?: number } = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const res = await listDevModeRuns(params);
      setRuns(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load dev runs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, isAuthorized]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5s while any run is in-flight
  useEffect(() => {
    const hasInFlight = runs.some(r => NON_TERMINAL.includes(r.status));
    if (!hasInFlight) return;
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [runs, load]);

  if (!isAuthorized) {
    return (
      <View style={styles.lockWrap}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Forbidden</Text>
        <Text style={styles.lockText}>Dev Mode runs are visible to super_admin only.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Dev Mode runs</Text>
        <Text style={styles.count}>{runs.length}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {STATUS_FILTERS.map(f => (
          <Pressable
            key={f.value || 'all'}
            onPress={() => setStatusFilter(f.value)}
            style={[styles.filterChip, statusFilter === f.value && styles.filterChipOn]}
          >
            <Text style={[styles.filterChipText, statusFilter === f.value && styles.filterChipTextOn]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.forest} />
        </View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.runRow} onPress={() => setSelected(item)} activeOpacity={0.7}>
              <View style={styles.runRowHeader}>
                <StatusPill status={item.status} />
                <Text style={styles.runRowMeta}>{relTime(item.startedAt || item.createdAt)}</Text>
              </View>
              <Text style={styles.runRowPrompt} numberOfLines={2}>{item.prompt}</Text>
              <View style={styles.runRowFooter}>
                {(item.linesAdded > 0 || item.linesDeleted > 0) && (
                  <Text style={styles.runRowFooterText}>
                    +{item.linesAdded} / -{item.linesDeleted}
                  </Text>
                )}
                <Text style={styles.runRowFooterText}>
                  turn {item.turnCount}/{item.maxTurns}
                </Text>
                {item.prUrl && (
                  <Text style={[styles.runRowFooterText, { color: COLORS.forest, fontWeight: '700' }]}>
                    PR #{item.prNumber || '?'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No dev-mode runs yet.</Text>
              <Text style={styles.emptyText}>
                Open the AI Assistant, switch on Dev Mode, and ask for a code change.
              </Text>
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />}
          contentContainerStyle={runs.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
        />
      )}

      {selected && (
        <DetailModal run={selected} onClose={() => setSelected(null)} onChanged={() => load(true)} />
      )}
    </View>
  );
}

function DetailModal({ run: initial, onClose, onChanged }: {
  run: DevModeRun;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [run, setRun] = useState<DevModeRun>(initial);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await getDevModeRun(initial.id);
      if (res.data) setRun(res.data);
    } catch (_) { /* ignore */ }
  }, [initial.id]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!NON_TERMINAL.includes(run.status)) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [run.status, refresh]);

  async function handleAnswer() {
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      await answerDevModeClarification(run.id, answer.trim());
      setAnswer('');
      await refresh();
      onChanged();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }
  async function handleAbort() {
    Alert.alert('Abort run?', 'This will stop the dev-mode run.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Abort', style: 'destructive', onPress: async () => {
          try {
            await abortDevModeRun(run.id);
            await refresh();
            onChanged();
          } catch (e: any) {
            Alert.alert('Error', e.message ?? 'Failed to abort');
          }
        },
      },
    ]);
  }

  const canAbort = NON_TERMINAL.includes(run.status);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Dev Mode run</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.modalClose}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={{ padding: 16 }}>
          <View style={{ marginBottom: 12 }}>
            <StatusPill status={run.status} />
          </View>

          <Field label="Run ID" value={run.id} />
          <Field label="Branch" value={run.branchName || '—'} />
          {run.prUrl && (
            <Pressable
              onPress={() => Linking.openURL(run.prUrl!).catch(() => {})}
              style={styles.prBtn}
            >
              <Text style={styles.prBtnText}>Open PR #{run.prNumber || '?'} on GitHub →</Text>
            </Pressable>
          )}
          <Field label="Diff" value={`+${run.linesAdded} / -${run.linesDeleted} across ${run.filesChanged?.length || 0} files`} />
          <Field label="Turns" value={`${run.turnCount}/${run.maxTurns}`} />
          {run.tokenUsage && (
            <Field
              label="Tokens"
              value={`${(run.tokenUsage.input as number) || 0} in / ${(run.tokenUsage.output as number) || 0} out`}
            />
          )}
          <Field label="Started" value={run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'} />
          {run.completedAt && (
            <Field label="Completed" value={new Date(run.completedAt).toLocaleString()} />
          )}

          <Section title="Prompt">
            <Text selectable style={styles.preText}>{run.prompt}</Text>
          </Section>

          {run.errorMessage && (
            <Section title="Error">
              <View style={styles.errBox}>
                <Text style={styles.errText} selectable>{run.errorMessage}</Text>
              </View>
            </Section>
          )}

          {run.status === 'awaiting_clarification' && run.clarificationQuestion && (
            <Section title="AI is asking">
              <View style={styles.clarifyBox}>
                <Text style={styles.clarifyText} selectable>{run.clarificationQuestion}</Text>
                <TextInput
                  style={styles.answerInput}
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Your answer..."
                  placeholderTextColor="#94a3b8"
                  multiline
                />
                <Pressable
                  style={[styles.submitBtn, (!answer.trim() || submitting) && { opacity: 0.5 }]}
                  onPress={handleAnswer}
                  disabled={!answer.trim() || submitting}
                >
                  <Text style={styles.submitBtnText}>{submitting ? '...' : 'Submit answer'}</Text>
                </Pressable>
              </View>
            </Section>
          )}

          {run.filesChanged && run.filesChanged.length > 0 && (
            <Section title="Files changed">
              {run.filesChanged.map((f, i) => (
                <Text key={i} style={styles.fileRow} selectable>
                  {f.path}  <Text style={{ color: '#64748b' }}>(+{f.additions} / -{f.deletions})</Text>
                </Text>
              ))}
            </Section>
          )}

          {run.clarificationAnswer && (
            <Section title="Your previous answer">
              <Text selectable style={styles.preText}>{run.clarificationAnswer}</Text>
            </Section>
          )}
        </ScrollView>

        {canAbort && (
          <View style={styles.modalFooter}>
            <Pressable style={styles.abortBtn} onPress={handleAbort}>
              <Text style={styles.abortBtnText}>Abort run</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text selectable style={styles.fieldValue}>{value}</Text>
    </View>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.forest,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backText: { color: '#fff', fontWeight: '600', fontSize: 14, width: 56 },
  title:    { flex: 1, textAlign: 'center', color: '#fff', fontWeight: '700', fontSize: 16 },
  count:    { color: '#ffffffaa', width: 56, textAlign: 'right', fontSize: 13 },

  filters: { paddingVertical: 8, paddingHorizontal: 12, maxHeight: 48 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 99, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.white, marginRight: 6,
  },
  filterChipOn: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  filterChipText: { color: COLORS.ink, fontSize: 12, fontWeight: '600' },
  filterChipTextOn: { color: '#fff' },

  pill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 99, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 11, fontWeight: '700' },

  runRow: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  runRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  runRowMeta: { fontSize: 11, color: COLORS.muted },
  runRowPrompt: { fontSize: 14, color: COLORS.ink, marginBottom: 6 },
  runRowFooter: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  runRowFooterText: { fontSize: 11, color: COLORS.muted },
  sep: { height: 1, backgroundColor: COLORS.border },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, color: COLORS.ink, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },

  lockWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: COLORS.cream },
  lockIcon: { fontSize: 32, marginBottom: 16 },
  lockTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  lockText: { fontSize: 14, color: COLORS.muted, textAlign: 'center' },

  modalContainer: { flex: 1, backgroundColor: COLORS.cream },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomColor: COLORS.border, borderBottomWidth: 1,
    backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  modalClose: { fontSize: 14, color: COLORS.forest, fontWeight: '600' },
  modalBody: { flex: 1 },
  modalFooter: { padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white },

  field: { flexDirection: 'row', marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted, width: 90 },
  fieldValue: { flex: 1, fontSize: 13, color: COLORS.ink, fontFamily: 'monospace' },

  section: { marginTop: 18 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.6, marginBottom: 6 },
  preText: {
    fontSize: 13, color: COLORS.ink,
    backgroundColor: COLORS.white, padding: 10, borderRadius: 6,
    borderColor: COLORS.border, borderWidth: 1,
  },
  errBox: { backgroundColor: '#fef2f2', padding: 10, borderRadius: 6 },
  errText: { color: '#991b1b', fontSize: 13 },
  clarifyBox: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 6 },
  clarifyText: { color: '#854d0e', fontSize: 13, marginBottom: 8 },
  answerInput: {
    backgroundColor: '#fff', borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 6, padding: 8, fontSize: 13, minHeight: 60,
    color: COLORS.ink,
  },
  submitBtn: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 6,
  },
  submitBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  fileRow: { fontSize: 12, color: COLORS.ink, fontFamily: 'monospace', paddingVertical: 2 },

  prBtn: {
    backgroundColor: COLORS.forest, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8, alignSelf: 'flex-start', marginVertical: 6,
  },
  prBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  abortBtn: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  abortBtnText: { color: '#991b1b', fontSize: 14, fontWeight: '700' },
});
