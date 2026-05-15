// ─── Research Tasks Screen ────────────────────────────────────────────────────
// Tier 2 background sourcing audit + detail.
// Lists every research task the user kicked off via /new-clients or
// /new-suppliers in the AI chat, with status pill, mode badge, brief
// preview. Tap to view summary + draft list with deep-links to the
// created Lead or Factory rows for review before outreach.

// Phase 4.6 part 5: extracted inline renderItem to a memo'd
// ResearchTaskCard; stable renderItem/keyExtractor; virtualization tuning.
import { memo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, ScrollView, Alert, Modal, Platform,
} from 'react-native';
import {
  listResearchTasks, getResearchTask, cancelResearchTask,
  type ResearchTask, type ResearchTaskStatus, type ResearchFinding,
} from '../../src/services/api';
import { COLORS } from '../../src/constants/config';
import { router } from 'expo-router';

const NON_TERMINAL: ResearchTaskStatus[] = ['queued', 'running'];

function formatAge(iso?: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 2)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Taipei' });
}

function statusColor(s: ResearchTaskStatus): string {
  if (s === 'completed') return '#1a7a3a';
  if (s === 'failed' || s === 'cancelled') return '#9a2222';
  return COLORS.muted;
}

function StatusPill({ status }: { status: ResearchTaskStatus }) {
  return (
    <View style={[styles.pill, { backgroundColor: statusColor(status) + '22', borderColor: statusColor(status) }]}>
      <Text style={[styles.pillText, { color: statusColor(status) }]}>{status}</Text>
    </View>
  );
}

function ModeBadge({ mode }: { mode: 'clients' | 'suppliers' }) {
  return (
    <View style={[styles.badge, { backgroundColor: mode === 'clients' ? '#e6f0ff' : '#fff3e0' }]}>
      <Text style={styles.badgeText}>{mode === 'clients' ? 'NEW CLIENTS' : 'NEW SUPPLIERS'}</Text>
    </View>
  );
}

// Phase 4.6 part 5: extracted row component. styles is module-scope so it
// doesn't need to be a prop. onPress is stable from the parent's useCallback.
const ResearchTaskCard = memo(function ResearchTaskCard({
  task, onPress,
}: {
  task: ResearchTask;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <ModeBadge mode={task.mode} />
        <StatusPill status={task.status} />
      </View>
      <Text style={styles.briefText} numberOfLines={2}>{task.brief}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>
          {task.status === 'completed'
            ? `${task.draftsCreated} draft${task.draftsCreated === 1 ? '' : 's'}` +
              (task.duplicatesFound ? ` · ${task.duplicatesFound} dup${task.duplicatesFound === 1 ? '' : 's'}` : '')
            : (task.errorMessage ? task.errorMessage.slice(0, 60) : '')}
        </Text>
        <Text style={styles.metaText}>{formatAge(task.completedAt || task.startedAt || task.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default function ResearchScreen() {
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<ResearchTask | null>(null);
  const [openLoading, setOpenLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listResearchTasks({ limit: 50 });
      setTasks(res.data ?? []);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not load research tasks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Light polling while any task is in-flight, so users see status changes
  // without manual pull-to-refresh.
  useEffect(() => {
    const anyActive = tasks.some(t => NON_TERMINAL.includes(t.status));
    if (!anyActive) return;
    const id = setInterval(() => { load(); }, 15000);
    return () => clearInterval(id);
  }, [tasks, load]);

  // Phase 4.6 part 5: stable refs for the memoized ResearchTaskCard.
  // openDetail is a function declaration so it's hoisted and the empty dep
  // array is safe (the closure captures the live binding).
  const researchKeyExtractor = useCallback((t: ResearchTask) => t.id, []);
  const researchRenderItem = useCallback(({ item }: { item: ResearchTask }) => (
    <ResearchTaskCard task={item} onPress={() => openDetail(item.id)} />
  ), []);

  async function openDetail(id: string) {
    setOpenId(id);
    setOpenLoading(true);
    try {
      const res = await getResearchTask(id);
      setOpenTask(res.data);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not load task.');
      setOpenId(null);
    } finally {
      setOpenLoading(false);
    }
  }

  async function handleCancel(id: string) {
    Alert.alert(
      'Cancel research?',
      'The background AI will be stopped and the task marked cancelled. Drafts already created will remain.',
      [
        { text: 'Keep running', style: 'cancel' },
        {
          text: 'Cancel task', style: 'destructive', onPress: async () => {
            try {
              await cancelResearchTask(id);
              await load();
              if (openId === id) {
                const res = await getResearchTask(id);
                setOpenTask(res.data);
              }
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Could not cancel.');
            }
          },
        },
      ],
    );
  }

  function navigateToDraft(f: ResearchFinding) {
    if (!f.draftId) return;
    if (f.type === 'lead' || f.type === 'customer') {
      router.navigate(`/(tabs)/leads?openId=${f.draftId}`);
    } else if (f.type === 'factory') {
      router.navigate(`/(tabs)/factories?openId=${f.draftId}`);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.cream }]}>
        <ActivityIndicator color={COLORS.forest} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.cream }}>
      {tasks.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <Text style={styles.emptyTitle}>No research yet</Text>
          <Text style={styles.emptyBody}>
            Open the AI Assistant and type{'\n'}
            <Text style={styles.code}>/new-clients canadian brake-pad importers</Text>{'\n'}
            or{'\n'}
            <Text style={styles.code}>/new-suppliers SPC flooring vietnam</Text>{'\n\n'}
            Runs in the background (5-15 min). You'll get a push notification when done.
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={researchKeyExtractor}
          contentContainerStyle={{ padding: 12 }}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={10}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={researchRenderItem}
        />
      )}

      {/* Detail modal */}
      <Modal visible={!!openId} animationType="slide" onRequestClose={() => { setOpenId(null); setOpenTask(null); }}>
        <View style={{ flex: 1, backgroundColor: COLORS.cream }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setOpenId(null); setOpenTask(null); }} style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              <Text style={{ color: COLORS.white, fontSize: 22 }}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Research task</Text>
            <View style={{ width: 40 }} />
          </View>

          {openLoading || !openTask ? (
            <View style={styles.center}><ActivityIndicator color={COLORS.forest} /></View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <ModeBadge mode={openTask.mode} />
                <StatusPill status={openTask.status} />
              </View>
              <Text style={styles.sectionLabel}>BRIEF</Text>
              <Text style={styles.bodyText}>{openTask.brief}</Text>

              {openTask.summary ? (
                <>
                  <Text style={styles.sectionLabel}>SUMMARY</Text>
                  <Text style={styles.bodyText}>{openTask.summary}</Text>
                </>
              ) : null}

              {openTask.errorMessage ? (
                <>
                  <Text style={styles.sectionLabel}>ERROR</Text>
                  <Text style={[styles.bodyText, { color: '#9a2222' }]}>{openTask.errorMessage}</Text>
                </>
              ) : null}

              <Text style={styles.sectionLabel}>FINDINGS</Text>
              {(openTask.findings ?? []).length === 0 ? (
                <Text style={styles.bodyText}>No findings.</Text>
              ) : (
                openTask.findings.map((f, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => navigateToDraft(f)}
                    style={[styles.finding, !f.draftId && styles.findingMuted]}
                    disabled={!f.draftId}
                  >
                    <Text style={styles.findingTitle}>{f.companyName}</Text>
                    {f.country ? <Text style={styles.findingMeta}>{f.country}</Text> : null}
                    {f.draftId ? (
                      <Text style={styles.findingTag}>✓ Draft created — tap to review</Text>
                    ) : f.dedupedAgainst ? (
                      <Text style={styles.findingTag}>↻ Already in {f.dedupedAgainst.type} ({f.dedupedAgainst.companyName})</Text>
                    ) : f.skipped ? (
                      <Text style={[styles.findingTag, { color: '#9a2222' }]}>⨯ Skipped: {f.skipped}</Text>
                    ) : null}
                    {f.evidence ? <Text style={styles.findingEvidence}>{f.evidence}</Text> : null}
                    {f.sourceUrl ? <Text style={styles.findingSource} numberOfLines={1}>{f.sourceUrl}</Text> : null}
                  </TouchableOpacity>
                ))
              )}

              {NON_TERMINAL.includes(openTask.status) ? (
                <TouchableOpacity onPress={() => handleCancel(openTask.id)} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel task</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink, marginBottom: 12 },
  emptyBody: { fontSize: 14, color: COLORS.muted, lineHeight: 22, textAlign: 'center' },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: COLORS.ink, backgroundColor: '#eee', paddingHorizontal: 4 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  briefText: { fontSize: 14, color: COLORS.ink, lineHeight: 20 },
  metaText: { fontSize: 12, color: COLORS.muted },

  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: '700', color: COLORS.ink, letterSpacing: 0.5 },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.forest, paddingTop: 50, paddingBottom: 12,
  },
  modalTitle: { color: COLORS.white, fontSize: 17, fontWeight: '700' },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted, marginTop: 18, marginBottom: 6, letterSpacing: 0.5 },
  bodyText: { fontSize: 14, color: COLORS.ink, lineHeight: 20 },

  finding: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  findingMuted: { opacity: 0.6 },
  findingTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  findingMeta: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  findingTag: { fontSize: 12, color: COLORS.forest, marginTop: 6, fontWeight: '600' },
  findingEvidence: { fontSize: 12, color: COLORS.muted, marginTop: 6, lineHeight: 16, fontStyle: 'italic' },
  findingSource: { fontSize: 11, color: COLORS.muted, marginTop: 4 },

  cancelButton: {
    marginTop: 24,
    backgroundColor: '#fde7e7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#9a2222', fontWeight: '700' },
});

