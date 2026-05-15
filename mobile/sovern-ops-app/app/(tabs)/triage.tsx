// ─── Triage Inbox Screen ──────────────────────────────────────────────────
// Mirror of the desktop CRM Triage Inbox (/crm/inbox).
// Shows inbound emails detected by the Cowork triage task and lets Alex
// decide quickly: promote → lead, forward to Fanzey (Egypt manager),
// mark spam, dismiss, or archive. Pull-to-refresh + manual sync request.

// Phase 4.6 part 4: TriageCard memoized + stable renderItem/keyExtractor.
import { memo, useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput, ScrollView, Platform,
} from 'react-native';
import {
  getTriageItems, promoteTriageToLead, forwardTriageToFanzey,
  markTriageSpam, dismissTriage, archiveTriage, requestTriageSync,
  listConnectedGoogleAccounts, sendTriageReply,
  type TriageItem, type ConnectedGoogleAccount,
} from '../../src/services/api';
import { COLORS } from '../../src/constants/config';
import { BrandBadge } from '../../src/components/BrandBadge';

type TabKey = 'pending' | 'forwarded' | 'archived' | 'all';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending',   label: 'Pending'   },
  { key: 'forwarded', label: 'Forwarded' },
  { key: 'archived', label: 'Archived'  },
  { key: 'all',       label: 'All'       },
];

const INTENT_META: Record<string, { label: string; bg: string; fg: string }> = {
  high:   { label: 'HIGH INTENT',   bg: '#DCFCE7', fg: '#166534' },
  medium: { label: 'MEDIUM INTENT', bg: '#FEF3C7', fg: '#92400E' },
  low:    { label: 'LOW INTENT',    bg: '#F3F4F6', fg: '#374151' },
  spam:   { label: 'LIKELY SPAM',   bg: '#FEE2E2', fg: '#991B1B' },
};

function senderDisplay(item: TriageItem) {
  if (item.senderName && item.senderCompany) {
    return `${item.senderName} · ${item.senderCompany}`;
  }
  return item.senderName || item.senderCompany || item.senderEmail;
}

const TriageCard = memo(function TriageCard({
  item, onAction, onReply, busyId,
}: {
  item: TriageItem;
  onAction: (id: string, action: 'promote' | 'forward' | 'spam' | 'dismiss' | 'archive') => void;
  onReply: (item: TriageItem) => void;
  busyId: string | null;
}) {
  const intent = INTENT_META[item.intentScore ?? 'low'] ?? INTENT_META.low;
  const isBusy = busyId === item.id;
  const isPending = item.status === 'pending';

  return (
    <View style={styles.card}>
      {/* Intent + brand + country */}
      <View style={styles.cardTopRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.intentBadge, { backgroundColor: intent.bg }]}>
            <Text style={[styles.intentBadgeText, { color: intent.fg }]}>{intent.label}</Text>
          </View>
          {/* Phase 4, C17: brand context on every card. */}
          <BrandBadge code={item.brandCode || 'SH'} size="sm" showLabel={false} />
        </View>
        {item.country ? <Text style={styles.countryText}>{item.country}</Text> : null}
      </View>

      {/* Sender */}
      <Text style={styles.sender}>{senderDisplay(item)}</Text>
      <Text style={styles.email}>{item.senderEmail}</Text>

      {/* Subject + snippet */}
      <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text>
      {item.bodySnippet ? (
        <Text style={styles.snippet} numberOfLines={3}>{item.bodySnippet}</Text>
      ) : null}

      {/* Meta */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {new Date(item.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', timeZone: 'Asia/Taipei',
          })}
        </Text>
        {item.productInterest ? (
          <Text style={styles.metaText}>· {item.productInterest}</Text>
        ) : null}
        {item.isReplyToOutreach ? (
          <Text style={[styles.metaText, { color: COLORS.forest, fontWeight: '600' }]}>
            · Reply to outreach
          </Text>
        ) : null}
      </View>

      {/* Actions — only on pending items */}
      {isPending && (
        <>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.promoteBtn, isBusy && styles.btnDisabled]}
              onPress={() => onAction(item.id, 'promote')}
              disabled={isBusy}
            >
              <Text style={styles.promoteBtnText}>+ Lead</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.forwardBtn, isBusy && styles.btnDisabled]}
              onPress={() => onAction(item.id, 'forward')}
              disabled={isBusy}
            >
              <Text style={styles.forwardBtnText}>→ Fanzey</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionsRowSecondary}>
            {/* Phase 4, C17: brand-aware reply launcher */}
            <TouchableOpacity
              style={[styles.secondaryBtn, isBusy && styles.btnDisabled]}
              onPress={() => onReply(item)}
              disabled={isBusy}
            >
              <Text style={styles.secondaryBtnText}>↩ Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, isBusy && styles.btnDisabled]}
              onPress={() => onAction(item.id, 'spam')}
              disabled={isBusy}
            >
              <Text style={styles.secondaryBtnText}>Spam</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, isBusy && styles.btnDisabled]}
              onPress={() => onAction(item.id, 'dismiss')}
              disabled={isBusy}
            >
              <Text style={styles.secondaryBtnText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, isBusy && styles.btnDisabled]}
              onPress={() => onAction(item.id, 'archive')}
              disabled={isBusy}
            >
              <Text style={styles.secondaryBtnText}>Archive</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Status badge for non-pending items */}
      {!isPending && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            {item.decidedAt ? ` · ${new Date(item.decidedAt).toLocaleDateString('en-US', { timeZone: 'Asia/Taipei' })}` : ''}
          </Text>
        </View>
      )}
    </View>
  );
});

export default function TriageScreen() {
  const [tab, setTab]               = useState<TabKey>('pending');
  const [items, setItems]           = useState<TriageItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId]         = useState<string | null>(null);
  const [syncing, setSyncing]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Phase 4, C17: brand-aware reply modal state.
  const [replyItem, setReplyItem]           = useState<TriageItem | null>(null);
  const [replySubject, setReplySubject]     = useState('');
  const [replyBody, setReplyBody]           = useState('');
  const [accounts, setAccounts]             = useState<ConnectedGoogleAccount[]>([]);
  const [fromAccountId, setFromAccountId]   = useState<string>('');
  const [replySending, setReplySending]     = useState(false);

  function openReply(item: TriageItem) {
    setReplyItem(item);
    setReplySubject(`Re: ${item.subject || ''}`);
    const quotedDate = new Date(item.createdAt).toLocaleString();
    const quotedFrom = item.senderName ? `${item.senderName} <${item.senderEmail}>` : item.senderEmail;
    setReplyBody(
      item.bodySnippet
        ? `\n\n\n--- Original Message ---\nFrom: ${quotedFrom}\nDate: ${quotedDate}\nSubject: ${item.subject || ''}\n\n${item.bodySnippet}`
        : '',
    );
    setFromAccountId('');
  }

  function closeReply() {
    setReplyItem(null);
    setReplySubject('');
    setReplyBody('');
    setFromAccountId('');
  }

  // Load connected accounts once the user opens a reply, and auto-select
  // the one matching the item's brand.
  useEffect(() => {
    if (!replyItem) return;
    listConnectedGoogleAccounts().then((list) => {
      setAccounts(list || []);
      const threadBrand = replyItem.brandCode || 'SH';
      const match = (list || []).find((a) => a.isActive !== false && (a.brandCode || null) === threadBrand);
      if (match) setFromAccountId(match.id);
    }).catch(() => setAccounts([]));
  }, [replyItem]);

  async function handleSendReply() {
    if (!replyItem) return;
    if (!replyBody.trim()) {
      Alert.alert('Body required', 'Write a reply before sending.');
      return;
    }
    setReplySending(true);
    try {
      await sendTriageReply({
        to: replyItem.senderEmail,
        subject: replySubject.trim() || `Re: ${replyItem.subject || ''}`,
        body: replyBody.trim(),
        triageItemId: replyItem.id,
        fromAccountId: fromAccountId || undefined,
      });
      Alert.alert('Sent', 'Reply sent.');
      closeReply();
    } catch (err: any) {
      Alert.alert('Send failed', err.message || 'Server error');
    } finally {
      setReplySending(false);
    }
  }

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const { items, pendingCount } = await getTriageItems(tab);
      setItems(items);
      setPendingCount(pendingCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(
    id: string,
    action: 'promote' | 'forward' | 'spam' | 'dismiss' | 'archive'
  ) {
    const confirmTitles: Record<typeof action, string> = {
      promote: 'Promote to Lead',
      forward: 'Forward to Fanzey',
      spam:    'Mark as Spam',
      dismiss: 'Dismiss',
      archive: 'Archive',
    };
    const confirmBodies: Record<typeof action, string> = {
      promote: 'Create a Lead from this email and remove it from the inbox?',
      forward: 'Forward this email to Mohannad Fanzey (Egypt) and mark forwarded?',
      spam:    'Mark as spam? It will be hidden from the pending list.',
      dismiss: 'Dismiss this email? It will be archived.',
      archive: 'Archive this email?',
    };

    Alert.alert(
      confirmTitles[action],
      confirmBodies[action],
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: action === 'spam' ? 'destructive' : 'default',
          onPress: async () => {
            setBusyId(id);
            try {
              if (action === 'promote') await promoteTriageToLead(id);
              else if (action === 'forward') await forwardTriageToFanzey(id);
              else if (action === 'spam') await markTriageSpam(id);
              else if (action === 'dismiss') await dismissTriage(id);
              else if (action === 'archive') await archiveTriage(id);

              // Optimistic remove from list (or refresh if viewing 'all')
              if (tab === 'all') {
                load(true);
              } else {
                setItems((prev) => prev.filter((i) => i.id !== id));
                if (tab === 'pending') setPendingCount((c) => Math.max(0, c - 1));
              }
            } catch (err: any) {
              Alert.alert('Action failed', err.message || 'Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await requestTriageSync();
      Alert.alert(
        'Sync requested',
        'Cowork will check Gmail for new messages. Pull to refresh in a few seconds.',
      );
    } catch (err: any) {
      Alert.alert('Sync failed', err.message || 'Could not request sync.');
    } finally {
      setSyncing(false);
    }
  }

  // Phase 4.6 part 4: stable refs for the memoized TriageCard.
  const triageRenderItem = useCallback(({ item }: { item: TriageItem }) => (
    <TriageCard item={item} onAction={handleAction} onReply={openReply} busyId={busyId} />
  ), [handleAction, openReply, busyId]);
  const triageKeyExtractor = useCallback((item: TriageItem) => item.id, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab pills */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const showBadge = t.key === 'pending' && pendingCount > 0;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabPill, active && styles.tabPillActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
                {t.label}
              </Text>
              {showBadge && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sync button row */}
      <View style={styles.syncRow}>
        <Text style={styles.syncHint}>
          {tab === 'pending'
            ? `${pendingCount} email${pendingCount === 1 ? '' : 's'} awaiting decision`
            : `${items.length} item${items.length === 1 ? '' : 's'}`}
        </Text>
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.btnDisabled]}
          onPress={handleSync}
          disabled={syncing}
        >
          <Text style={styles.syncBtnText}>{syncing ? 'Syncing…' : '⟳ Sync now'}</Text>
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* List — Phase 4.6 part 4 virtualization + stable refs */}
      <FlatList
        data={items}
        keyExtractor={triageKeyExtractor}
        renderItem={triageRenderItem}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={10}
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
            <Text style={styles.emptyIcon}>📥</Text>
            <Text style={styles.emptyTitle}>
              {tab === 'pending' ? 'Inbox zero' : `No ${tab} items`}
            </Text>
            <Text style={styles.emptyText}>
              {tab === 'pending'
                ? 'No incoming emails awaiting your decision.'
                : `Nothing to show in ${tab}.`}
            </Text>
          </View>
        )}
      />

      {/* Phase 4, C17: brand-aware reply modal */}
      <Modal
        visible={!!replyItem}
        animationType="slide"
        transparent
        onRequestClose={closeReply}
      >
        <View style={styles.replyOverlay}>
          <View style={styles.replyCard}>
            <View style={styles.replyHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.replyTitle}>Reply</Text>
                {replyItem ? <BrandBadge code={replyItem.brandCode || 'SH'} size="sm" showLabel={false} /> : null}
              </View>
              <TouchableOpacity onPress={closeReply}>
                <Text style={styles.replyClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
              <View>
                <Text style={styles.replyLabel}>To</Text>
                <Text style={styles.replyReadonly}>{replyItem?.senderEmail}</Text>
              </View>

              <View>
                <Text style={styles.replyLabel}>From (brand-matched accounts only)</Text>
                {accounts.length === 0 ? (
                  <Text style={styles.replyHint}>
                    No connected accounts. Add one via the desktop ERP → Settings → Connected Accounts.
                  </Text>
                ) : (
                  <View style={styles.accountPicker}>
                    {accounts.map((a) => {
                      const threadBrand = replyItem?.brandCode || 'SH';
                      const accBrand = a.brandCode || null;
                      const enabled = accBrand === threadBrand;
                      const selected = a.id === fromAccountId;
                      return (
                        <TouchableOpacity
                          key={a.id}
                          style={[
                            styles.accountOption,
                            selected && styles.accountOptionSelected,
                            !enabled && styles.accountOptionDisabled,
                          ]}
                          onPress={() => enabled && setFromAccountId(a.id)}
                          disabled={!enabled}
                        >
                          <Text style={[
                            styles.accountOptionText,
                            selected && styles.accountOptionTextSelected,
                            !enabled && styles.accountOptionTextDisabled,
                          ]}>
                            {a.email} {accBrand ? `[${accBrand}]` : '[no brand]'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <Text style={styles.replyHint}>
                  Thread brand is {replyItem?.brandCode || 'SH'}. Replies must come from a {replyItem?.brandCode || 'SH'} account.
                </Text>
              </View>

              <View>
                <Text style={styles.replyLabel}>Subject</Text>
                <TextInput
                  style={styles.replyInput}
                  value={replySubject}
                  onChangeText={setReplySubject}
                />
              </View>

              <View>
                <Text style={styles.replyLabel}>Message</Text>
                <TextInput
                  style={[styles.replyInput, styles.replyBody]}
                  multiline
                  numberOfLines={10}
                  value={replyBody}
                  onChangeText={setReplyBody}
                  placeholder="Write your reply..."
                />
              </View>
            </ScrollView>

            <View style={styles.replyFooter}>
              <TouchableOpacity
                onPress={closeReply}
                style={styles.replyCancelBtn}
                disabled={replySending}
              >
                <Text style={styles.replyCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSendReply}
                style={[styles.replySendBtn, replySending && styles.btnDisabled]}
                disabled={replySending}
              >
                <Text style={styles.replySendText}>{replySending ? 'Sending…' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },

  // ── Tab bar ────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 6,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.cream,
    gap: 6,
  },
  tabPillActive:    { backgroundColor: COLORS.forest },
  tabPillText:      { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  tabPillTextActive:{ color: COLORS.white },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },

  // ── Sync row ───────────────────────────────────────────────────────────
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  syncHint:   { fontSize: 12, color: COLORS.muted },
  syncBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border,
  },
  syncBtnText: { fontSize: 12, color: COLORS.forest, fontWeight: '600' },

  // ── Error ──────────────────────────────────────────────────────────────
  errorBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#FECACA',
  },
  errorText: { color: COLORS.error, fontSize: 13, fontWeight: '500' },

  // ── Card ───────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  intentBadge: {
    paddingVertical: 3, paddingHorizontal: 8,
    borderRadius: 4,
  },
  intentBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  countryText:     { fontSize: 12, color: COLORS.muted, fontWeight: '500' },

  sender:  { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  email:   { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  subject: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginTop: 8 },
  snippet: { fontSize: 13, color: COLORS.muted, marginTop: 4, lineHeight: 18 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaText: { fontSize: 11, color: COLORS.muted },

  // ── Actions ────────────────────────────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionsRowSecondary: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  promoteBtn:     { backgroundColor: COLORS.forest },
  promoteBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  forwardBtn:     { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  forwardBtnText: { color: '#92400E', fontWeight: '700', fontSize: 13 },

  secondaryBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.muted, fontWeight: '600', fontSize: 12 },

  btnDisabled: { opacity: 0.5 },

  // ── Status (non-pending) ───────────────────────────────────────────────
  statusBadge: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.cream,
    alignSelf: 'flex-start',
  },
  statusBadgeText: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },

  // ── Empty ──────────────────────────────────────────────────────────────
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptyText:  { fontSize: 14, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 40 },

  // Phase 4, C17: brand-aware reply modal
  replyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  replyCard: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: '92%',
    minHeight: '70%',
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  replyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  replyClose: { fontSize: 22, color: COLORS.muted },
  replyLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.muted,
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4,
  },
  replyReadonly: {
    fontSize: 14, color: COLORS.ink,
    paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: COLORS.white, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  replyInput: {
    fontSize: 14, color: COLORS.ink,
    paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: COLORS.white, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  replyBody: {
    minHeight: 140, textAlignVertical: 'top',
  },
  replyHint: { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  accountPicker: { gap: 6 },
  accountOption: {
    paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 6,
  },
  accountOptionSelected: {
    borderColor: COLORS.forest,
    backgroundColor: COLORS.forest + '15',
  },
  accountOptionDisabled: {
    opacity: 0.4,
  },
  accountOptionText: { fontSize: 13, color: COLORS.ink },
  accountOptionTextSelected: { color: COLORS.forest, fontWeight: '700' },
  accountOptionTextDisabled: { color: COLORS.muted },
  replyFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  replyCancelBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 6, backgroundColor: COLORS.cream,
  },
  replyCancelText: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  replySendBtn: {
    paddingVertical: 8, paddingHorizontal: 18,
    backgroundColor: COLORS.forest, borderRadius: 6,
  },
  replySendText: { fontSize: 13, color: COLORS.white, fontWeight: '700' },
});
