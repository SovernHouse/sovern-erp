// ─── Lead Detail Screen ────────────────────────────────────────────────────
// Route: /lead/:id  (Expo Router dynamic segment)
// Shows full lead profile: contact info, status, value, notes, activities.
// Manager can change status or add a note inline.

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, RefreshControl,
  KeyboardAvoidingView, Platform, Linking, Share,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import {
  getLead, addActivity, updateLeadStatus, aiChat,
  type Lead, type Activity,
} from '../../src/services/api';
import { COLORS } from '../../src/constants/config';
import ChatterSection from '../../src/components/ChatterSection';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  { key: 'new',         label: 'New',         color: COLORS.statusNew },
  { key: 'contacted',   label: 'Contacted',   color: COLORS.statusContacted },
  { key: 'qualified',   label: 'Qualified',   color: COLORS.statusQualified },
  { key: 'proposal',    label: 'Proposal',    color: COLORS.statusProposal },
  { key: 'negotiation', label: 'Negotiation', color: COLORS.statusNegotiation },
  { key: 'won',         label: 'Won',         color: COLORS.success },
  { key: 'lost',        label: 'Lost',        color: COLORS.statusClosed },
];

const ACTIVITY_ICONS: Record<string, string> = {
  note:     '📝',
  call:     '📞',
  email:    '✉️',
  meeting:  '🤝',
  task:     '✅',
};

function formatCurrency(value?: number, currency = 'USD') {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return formatDate(iso);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  if (!value) return null;
  return (
    <TouchableOpacity
      style={styles.infoRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, onPress && styles.infoValueLink]}>{value}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function ActivityItem({ item }: { item: Activity }) {
  const icon = ACTIVITY_ICONS[item.type] ?? '📋';
  return (
    <View style={styles.activityItem}>
      <Text style={styles.activityIcon}>{icon}</Text>
      <View style={styles.activityBody}>
        <Text style={styles.activityNote}>{item.subject || item.description || item.type}</Text>
        <Text style={styles.activityDate}>{timeAgo(item.createdAt)}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Status change
  const [statusModal, setStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Add note modal
  const [noteModal, setNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<'note' | 'call' | 'email' | 'meeting'>('note');
  const [addingNote, setAddingNote] = useState(false);

  // AI refine modal
  const [aiModal, setAiModal] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; content: string; error?: boolean }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiConvId, setAiConvId] = useState<string | null>(null);
  const [aiSending, setAiSending] = useState(false);

  const noteInputRef = useRef<TextInput>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const data = await getLead(id);
      setLead(data);
      // Set the header title to the company name
      navigation.setOptions({ title: data.companyName });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(newStatus: string) {
    if (!lead || newStatus === lead.status) { setStatusModal(false); return; }
    setUpdatingStatus(true);
    try {
      const updated = await updateLeadStatus(lead.id, newStatus);
      setLead((prev) => prev ? { ...prev, status: updated.status } : prev);
      setStatusModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  function buildAiContext(l: Lead): string {
    const parts: (string | null)[] = [
      `## Lead context — you are helping the user with this specific lead. Be conversational and direct.`,
      ``,
      `Lead ID: ${l.id}`,
      `Company: ${l.companyName}${l.country ? ` (${l.country})` : ''}`,
      `Contact: ${l.contactName || '(unknown)'} <${l.email}>`,
      `Industry: ${l.industry || '(empty — fill in if you can verify it)'}`,
      `Address: ${l.address || '(empty — fill in if a street address is on the company\'s site)'}`,
      `City: ${l.city || '(empty)'}`,
      `State / Province: ${l.state || '(empty)'}`,
      `Country: ${l.country || '(empty)'}`,
      l.vertical ? `Vertical: ${l.vertical}` : null,
      ``,
      `Current draft email subject: ${l.draftEmailSubject || '(empty)'}`,
      ``,
      `Current draft email body:`,
      `"""`,
      l.draftEmailBody || '(empty)',
      `"""`,
      ``,
      `## What you can do for the user`,
      ``,
      `1. **Refine the draft email** — call update_lead with new draftEmailSubject and/or draftEmailBody. Sovern voice: 80-120 words, no em dashes, one ask, L-014 factory-direct positioning for Malaysia LVT/SPC ("we're shipping from our factory in Malaysia," never middleman framing).`,
      `2. **Answer questions about the draft** — is the opener relevant? Is the tariff angle accurate? Be direct.`,
      `3. **Answer questions about the lead** — what does this company sell? Likely to import direct? Use WebFetch / WebSearch to verify; don't fabricate.`,
      `4. **Fill in missing lead fields** — fetch the company's site, populate empty fields via update_lead. Leave anything unverified empty and say so.`,
      ``,
      `Always summarise update_lead changes in your text reply too.`,
      ``,
      `## User request`,
      ``,
    ];
    return parts.filter(p => p !== null).join('\n');
  }

  async function handleAiSend(text?: string) {
    if (!lead) return;
    const trimmed = (text || aiInput).trim();
    if (!trimmed || aiSending) return;
    setAiInput('');
    setAiMessages(m => [...m, { role: 'user', content: trimmed }]);
    setAiSending(true);
    try {
      const messageToSend = aiConvId ? trimmed : (buildAiContext(lead) + trimmed);
      const res = await aiChat(messageToSend, aiConvId || undefined);
      if (res.conversationId && !aiConvId) setAiConvId(res.conversationId);
      setAiMessages(m => [...m, { role: 'assistant', content: res.reply || '(no reply)' }]);
      // Refetch lead silently so the draft email updates if the AI edited it
      try {
        const fresh = await getLead(lead.id);
        setLead(fresh);
      } catch (_) { /* non-fatal */ }
    } catch (err: any) {
      setAiMessages(m => [...m, { role: 'assistant', content: err.message || 'AI request failed', error: true }]);
    } finally {
      setAiSending(false);
    }
  }

  async function handleAddNote() {
    if (!lead) return;
    if (!noteText.trim()) {
      Alert.alert('Required', 'Write something before saving.');
      return;
    }
    setAddingNote(true);
    try {
      await addActivity(lead.id, noteText.trim(), noteType);
      setNoteText('');
      setNoteModal(false);
      // Reload to get the updated activity list
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAddingNote(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Lead not found.</Text>
      </View>
    );
  }

  const statusDef = STATUSES.find((s) => s.key === lead.status) ?? STATUSES[0];
  const activities = (lead.activities ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />
        }
      >
        {/* ── Header card ─────────────────────────────────────────────────── */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.initials}>
              <Text style={styles.initialsText}>
                {lead.companyName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.companyName}>{lead.companyName}</Text>
              <Text style={styles.contactName}>{lead.contactName}</Text>
              {lead.country ? <Text style={styles.country}>{lead.country}</Text> : null}
            </View>
          </View>

          {/* Status row */}
          <TouchableOpacity
            style={styles.statusRow}
            onPress={() => setStatusModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.statusPill, { backgroundColor: statusDef.color + '18', borderColor: statusDef.color }]}>
              <View style={[styles.statusDot, { backgroundColor: statusDef.color }]} />
              <Text style={[styles.statusLabel, { color: statusDef.color }]}>{statusDef.label}</Text>
            </View>
            <Text style={styles.statusChangeHint}>Change ›</Text>
          </TouchableOpacity>

          {/* Value */}
          {lead.estimatedValue ? (
            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>Estimated Value</Text>
              <Text style={styles.valueAmount}>
                {formatCurrency(lead.estimatedValue, lead.currency)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Contact ─────────────────────────────────────────────────────── */}
        <SectionHeader title="Contact" />
        <View style={styles.card}>
          <InfoRow
            label="Email"
            value={lead.email}
            onPress={() => Linking.openURL(`mailto:${lead.email}`)}
          />
          <InfoRow
            label="Phone"
            value={lead.phone}
            onPress={lead.phone ? () => Linking.openURL(`tel:${lead.phone}`) : undefined}
          />
          <InfoRow label="City" value={lead.city} />
          <InfoRow label="State / Province" value={lead.state} />
          <InfoRow label="Country" value={lead.country} />
          <InfoRow label="Industry" value={lead.industry} />
          <InfoRow label="Source" value={lead.source} />
          {lead.createdBySource === 'ai_research' ? (
            <View style={styles.aiCreditRow}>
              <Text style={styles.aiCreditBadge}>🤖 AI Assistant</Text>
              {lead.createdBy ? (
                <Text style={styles.aiCreditText}>
                  on behalf of {`${lead.createdBy.firstName || ''} ${lead.createdBy.lastName || ''}`.trim() || lead.createdBy.email}
                </Text>
              ) : null}
            </View>
          ) : lead.createdBy ? (
            <InfoRow label="Created By" value={`${lead.createdBy.firstName || ''} ${lead.createdBy.lastName || ''}`.trim() || lead.createdBy.email} />
          ) : null}
        </View>

        {/* ── Draft Cold Email — review/edit before sending; never sent automatically ─── */}
        {(lead.draftEmailSubject || lead.draftEmailBody) ? (
          <>
            <SectionHeader title="Draft Cold Email" />
            <View style={[styles.card, styles.draftCard]}>
              {lead.draftEmailSubject ? (
                <View style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Subject</Text>
                  <Text style={styles.draftSubject}>{lead.draftEmailSubject}</Text>
                </View>
              ) : null}
              {lead.draftEmailBody ? (
                <View style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Body</Text>
                  <Text style={styles.draftBody}>{lead.draftEmailBody}</Text>
                </View>
              ) : null}
              <View style={styles.draftActions}>
                <TouchableOpacity
                  style={styles.draftActionBtn}
                  onPress={() => {
                    const subject = lead.draftEmailSubject || '';
                    const body = lead.draftEmailBody || '';
                    const mailto = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    Linking.openURL(mailto).catch(() => Alert.alert('Cannot open mail app'));
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.draftActionText}>Open in Mail app</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.draftActionBtn, styles.draftActionBtnSecondary]}
                  onPress={() => {
                    const text = `Subject: ${lead.draftEmailSubject || ''}\n\n${lead.draftEmailBody || ''}`;
                    Share.share({ message: text }).catch(() => {});
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.draftActionText, styles.draftActionTextSecondary]}>Share</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.draftActionBtn, styles.aiRefineBtn]}
                onPress={() => setAiModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.draftActionText}>✨ Refine with AI</Text>
              </TouchableOpacity>
              <Text style={styles.draftHint}>Review the copy before sending. Nothing sends automatically.</Text>
            </View>
          </>
        ) : null}

        {/* ── Product interest ─────────────────────────────────────────────── */}
        {lead.productInterests ? (
          <>
            <SectionHeader title="Product Interest" />
            <View style={styles.card}>
              <Text style={styles.notesBody}>{lead.productInterests}</Text>
            </View>
          </>
        ) : null}

        {/* ── Notes ───────────────────────────────────────────────────────── */}
        {lead.notes ? (
          <>
            <SectionHeader title="Notes" />
            <View style={styles.card}>
              <Text style={styles.notesBody}>{lead.notes}</Text>
            </View>
          </>
        ) : null}

        {/* ── Activities ──────────────────────────────────────────────────── */}
        <View style={styles.activitiesHeader}>
          <SectionHeader title={`Activity${activities.length ? ` (${activities.length})` : ''}`} />
          <TouchableOpacity
            style={styles.addNoteBtn}
            onPress={() => setNoteModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addNoteBtnText}>+ Add Note</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {activities.length === 0 ? (
            <Text style={styles.emptyActivities}>No activity yet. Add a note above.</Text>
          ) : (
            activities.map((a, i) => (
              <View key={a.id}>
                <ActivityItem item={a} />
                {i < activities.length - 1 && <View style={styles.activityDivider} />}
              </View>
            ))
          )}
        </View>

        {/* ── Chatter ─────────────────────────────────────────────────── */}
        <View style={styles.activitiesHeader}>
          <SectionHeader title="Notes & Chatter" />
        </View>
        <ChatterSection entityType="Lead" entityId={lead.id} />

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Status change modal ──────────────────────────────────────────── */}
      <Modal
        visible={statusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Change Status</Text>
            {updatingStatus ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color={COLORS.forest} />
              </View>
            ) : (
              STATUSES.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.statusOption,
                    lead.status === s.key && styles.statusOptionActive,
                  ]}
                  onPress={() => handleStatusChange(s.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusOptionDot, { backgroundColor: s.color }]} />
                  <Text style={[
                    styles.statusOptionLabel,
                    lead.status === s.key && { fontWeight: '700', color: COLORS.ink },
                  ]}>
                    {s.label}
                  </Text>
                  {lead.status === s.key && <Text style={styles.statusOptionCheck}>✓</Text>}
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setStatusModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add note modal ───────────────────────────────────────────────── */}
      <Modal
        visible={noteModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setNoteModal(false); setNoteText(''); }}
        onShow={() => setTimeout(() => noteInputRef.current?.focus(), 100)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add Note</Text>

              {/* Type selector */}
              <View style={styles.noteTypeRow}>
                {(['note', 'call', 'email', 'meeting'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.noteTypeChip, noteType === t && styles.noteTypeChipActive]}
                    onPress={() => setNoteType(t)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.noteTypeIcon}>{ACTIVITY_ICONS[t]}</Text>
                    <Text style={[
                      styles.noteTypeLabel,
                      noteType === t && styles.noteTypeLabelActive,
                    ]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                ref={noteInputRef}
                style={styles.noteInput}
                value={noteText}
                onChangeText={setNoteText}
                multiline
                numberOfLines={4}
                placeholder="What happened? What was discussed?"
                placeholderTextColor={COLORS.muted}
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => { setNoteModal(false); setNoteText(''); }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, addingNote && { opacity: 0.6 }]}
                  onPress={handleAddNote}
                  disabled={addingNote}
                >
                  <Text style={styles.modalSubmitText}>
                    {addingNote ? 'Saving...' : 'Save Note'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* AI Refine modal */}
      <Modal
        visible={aiModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAiModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: COLORS.cream }}
        >
          <View style={styles.aiHeader}>
            <Text style={styles.aiHeaderTitle}>✨ Refine Draft with AI</Text>
            <TouchableOpacity onPress={() => setAiModal(false)} activeOpacity={0.7}>
              <Text style={styles.aiHeaderClose}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {aiMessages.length === 0 && !aiSending ? (
              <Text style={styles.aiEmpty}>
                Ask the AI to refine the draft. It will edit the lead live and the Draft Email card will update when you close this.
              </Text>
            ) : (
              aiMessages.map((m, i) => (
                <View
                  key={i}
                  style={[
                    styles.aiBubble,
                    m.role === 'user' ? styles.aiBubbleUser : styles.aiBubbleAi,
                    m.error ? styles.aiBubbleError : null,
                  ]}
                >
                  <Text style={[styles.aiBubbleText, m.role === 'user' ? styles.aiBubbleTextUser : null]}>
                    {m.content}
                  </Text>
                </View>
              ))
            )}
            {aiSending && (
              <View style={styles.aiBubbleAi}>
                <ActivityIndicator size="small" color={COLORS.forest} />
                <Text style={styles.aiThinking}>Thinking… may take 30–60s</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.aiQuickRow}>
            {[
              { label: 'Fill missing fields', prompt: 'Fetch this company\'s website and use update_lead to fill any empty fields (industry, address, city, state, country, website). Do not fabricate — leave anything unverifiable empty and tell me which.' },
              { label: 'Is draft relevant?', prompt: 'Critique the current draft email. Is the opener relevant to this company? Tariff angle accurate? Be direct.' },
              { label: 'Shorter', prompt: 'Tighten the draft to 60-80 words. Keep the specific opener and factory-direct positioning. Save with update_lead.' },
              { label: 'More direct', prompt: 'Rewrite the draft in a more direct tone. Cut hedges. One clear ask. Save with update_lead.' },
              { label: 'Verify company', prompt: 'Look up this company online and tell me if they actually distribute LVT/SPC at scale, what region, any recent news. Link your sources.' },
              { label: 'New subject', prompt: 'Propose 3 alternative subject lines (3-6 words each, lowercase except proper nouns). Pick the best and save via update_lead.' },
            ].map((a) => (
              <TouchableOpacity
                key={a.label}
                style={styles.aiQuickChip}
                onPress={() => handleAiSend(a.prompt)}
                disabled={aiSending}
                activeOpacity={0.7}
              >
                <Text style={styles.aiQuickChipText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.aiInputRow}>
            <TextInput
              style={styles.aiInput}
              value={aiInput}
              onChangeText={setAiInput}
              placeholder="Ask anything about this lead…"
              placeholderTextColor={COLORS.muted}
              editable={!aiSending}
              multiline
            />
            <TouchableOpacity
              style={[styles.aiSendBtn, (aiSending || !aiInput.trim()) ? { opacity: 0.5 } : null]}
              onPress={() => handleAiSend()}
              disabled={aiSending || !aiInput.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.aiSendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content:   { padding: 16 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },

  // Header card
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  initials: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.forest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: { color: COLORS.white, fontSize: 22, fontWeight: '700' },
  headerMeta: { flex: 1 },
  companyName: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  contactName: { fontSize: 14, color: COLORS.muted, marginTop: 2 },
  country:     { fontSize: 13, color: COLORS.forest, marginTop: 3 },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontWeight: '600' },
  statusChangeHint: { fontSize: 13, color: COLORS.muted },

  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  valueLabel:  { fontSize: 13, color: COLORS.muted },
  valueAmount: { fontSize: 20, fontWeight: '800', color: COLORS.forest },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    gap: 10,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLine:  { flex: 1, height: 1, backgroundColor: COLORS.border },

  // Info card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel:     { fontSize: 13, color: COLORS.muted },
  infoValue:     { fontSize: 13, color: COLORS.ink, fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: 12 },
  infoValueLink: { color: COLORS.forest, textDecorationLine: 'underline' },

  notesBody: { padding: 16, fontSize: 14, color: COLORS.ink, lineHeight: 21 },

  // AI attribution badge inside Contact card
  aiCreditRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  aiCreditBadge: { backgroundColor: '#D1FAE5', color: '#065F46', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  aiCreditText: { color: COLORS.muted, fontSize: 13 },

  // Draft cold email card
  draftCard: {
    borderColor: COLORS.forest,
    borderWidth: 1,
    backgroundColor: '#F1F7F2',
  },
  draftRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  draftLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  draftSubject: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  draftBody: { fontSize: 14, color: COLORS.ink, lineHeight: 21 },
  draftActions: { flexDirection: 'row', padding: 12, gap: 10 },
  draftActionBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: COLORS.forest,
    borderRadius: 8,
    alignItems: 'center',
  },
  draftActionBtnSecondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.forest },
  aiRefineBtn: { backgroundColor: '#2563EB', marginHorizontal: 12, marginBottom: 8 },
  draftActionText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  draftActionTextSecondary: { color: COLORS.forest },
  draftHint: { fontSize: 12, color: COLORS.muted, paddingHorizontal: 16, paddingBottom: 12, fontStyle: 'italic' },

  // AI refine modal
  aiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  aiHeaderTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  aiHeaderClose: { fontSize: 15, color: COLORS.forest, fontWeight: '600' },
  aiEmpty: { color: COLORS.muted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24, fontSize: 14 },
  aiBubble: { padding: 12, borderRadius: 12, marginBottom: 10, maxWidth: '88%' },
  aiBubbleUser: { backgroundColor: '#2563EB', alignSelf: 'flex-end' },
  aiBubbleAi: { backgroundColor: COLORS.white, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border },
  aiBubbleError: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  aiBubbleText: { color: COLORS.ink, fontSize: 14, lineHeight: 20 },
  aiBubbleTextUser: { color: COLORS.white },
  aiThinking: { color: COLORS.muted, fontSize: 13, marginTop: 4 },
  aiQuickRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6, backgroundColor: COLORS.cream, borderTopWidth: 1, borderTopColor: COLORS.border },
  aiQuickChip: { backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#93C5FD' },
  aiQuickChipText: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },
  aiInputRow: { flexDirection: 'row', padding: 12, gap: 8, alignItems: 'flex-end', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  aiInput: { flex: 1, backgroundColor: COLORS.cream, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink, maxHeight: 100, minHeight: 40 },
  aiSendBtn: { backgroundColor: '#2563EB', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  aiSendBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },

  // Activities
  activitiesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addNoteBtn: {
    backgroundColor: COLORS.forest,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  addNoteBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  activityItem:    { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  activityIcon:    { fontSize: 20, marginTop: 1 },
  activityBody:    { flex: 1 },
  activityNote:    { fontSize: 14, color: COLORS.ink, lineHeight: 20 },
  activityDate:    { fontSize: 12, color: COLORS.muted, marginTop: 3 },
  activityDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: 46 },

  emptyActivities: { padding: 20, color: COLORS.muted, fontSize: 14, textAlign: 'center' },
  emptyText:       { color: COLORS.muted, fontSize: 14 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle:  { fontSize: 18, fontWeight: '700', color: COLORS.ink, marginBottom: 14 },
  modalLoading: { paddingVertical: 30, alignItems: 'center' },

  // Status options
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  statusOptionActive:  { backgroundColor: COLORS.cream },
  statusOptionDot:     { width: 10, height: 10, borderRadius: 5 },
  statusOptionLabel:   { flex: 1, fontSize: 15, color: COLORS.ink },
  statusOptionCheck:   { fontSize: 15, color: COLORS.forest, fontWeight: '700' },

  modalCancel: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: 10,
  },
  modalCancelText: { color: COLORS.muted, fontWeight: '600', fontSize: 15 },

  // Note type chips
  noteTypeRow:      { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  noteTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cream,
  },
  noteTypeChipActive: { borderColor: COLORS.forest, backgroundColor: COLORS.forest + '12' },
  noteTypeIcon:  { fontSize: 14 },
  noteTypeLabel: { fontSize: 13, color: COLORS.muted },
  noteTypeLabelActive: { color: COLORS.forest, fontWeight: '600' },

  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: COLORS.ink,
    minHeight: 110,
    marginBottom: 14,
  },
  modalActions:    { flexDirection: 'row', gap: 10 },
  modalCancelBtn:  { flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.cream, borderRadius: 10 },
  modalSubmitBtn:  { flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.forest, borderRadius: 10 },
  modalSubmitText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
