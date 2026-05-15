// ─── AI Assistant Screen ──────────────────────────────────────────────────────
// Sovern House AI — a context-aware trade assistant powered by Claude.
// Two-view pattern (same as chat.tsx):
//   View 1: conversation list — pull to refresh, tap to open, swipe-delete via long-press menu
//   View 2: thread view — scrollable messages + compose bar
//
// Calls the same /api/ai backend as the admin portal AssistantPage.jsx.
// The backend spawns a claude -p subprocess with a live ERP snapshot so the
// assistant knows the current pipeline, leads, and open triage items.

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, Pressable, Alert, ScrollView, Modal, Share,
} from 'react-native';
// NOTE: voice input on mobile was removed because it would require
// expo-speech-recognition (a native module not in Expo Go), and ship a
// custom native build (which iOS-side requires an Apple Dev account).
// Voice still works on the admin web AssistantPage via the browser's
// built-in webkitSpeechRecognition API. If we ever ship a custom mobile
// build (Android APK or iOS with Apple Dev membership), the package
// ~3.1.3 + the press-and-hold mic UI can come back from git history at
// commit 87d9793.
import {
  aiChat, aiListConversations, aiGetConversation, aiDeleteConversation,
  aiRenameConversation, uploadAttachment,
  startDevModeRun, getDevModeRun, answerDevModeClarification,
  startResearchTask, getResearchTask, getCustomers, getFactories, getProducts,
  listExpenses, createExpense, listExpenseOffices,
  createExpenseSubmission, generateSubmissionReport,
  type AIConversation, type AIMessage, type AIAttachment,
  type DevModeRun, type DevModeRunStatus,
  type ResearchTaskMode,
} from '../../src/services/api';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS } from '../../src/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const DEV_MODE_KEY = 'sovern.ai.devModeOn';
const PENDING_RESEARCH_KEY = 'sovern.ai.pendingResearch';
const NON_TERMINAL_RUN: DevModeRunStatus[] = ['queued', 'running', 'opening_pr', 'awaiting_clarification'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2)   return 'just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7)   return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Taipei' });
}

// Very light markdown → plain text cleanup for mobile display.
// Removes **bold** markers, # headers, and --- rules; preserves newlines.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
    .replace(/^#{1,3}\s+/gm, '')           // headings
    .replace(/^---+$/gm, '─────────────')  // hr
    .replace(/^[*\-+] /gm, '• ')           // bullet list items
    .replace(/`([^`]+)`/g, '$1');          // inline code
}

// ─── Slash commands ───────────────────────────────────────────────────────────

type SlashKind =
  | 'new-clients' | 'new-suppliers'
  | 'clients' | 'suppliers' | 'products'
  | 'expense' | 'expenses' | 'expense-report';

interface ParsedSlash {
  kind: SlashKind;
  arg: string;
}

interface SlashSpec {
  name: SlashKind;
  args: string;
  desc: string;
}

const SLASH_COMMANDS: SlashSpec[] = [
  { name: 'new-clients',    args: '<brief>',                    desc: 'Source NEW client prospects (background research, 5-15 min)' },
  { name: 'new-suppliers',  args: '<brief>',                    desc: 'Source NEW factories (background research, 5-15 min)' },
  { name: 'clients',        args: '<query>',                    desc: 'Search existing customers' },
  { name: 'suppliers',      args: '<query>',                    desc: 'Search existing factories' },
  { name: 'products',       args: '<query>',                    desc: 'Search existing products' },
  { name: 'expense',        args: '<amount> <ccy> <description>', desc: 'Quick-log an expense (e.g. /expense 142 TWD taxi from airport)' },
  { name: 'expenses',       args: '[unpaid|all]',               desc: 'List recent expenses (default: unpaid only)' },
  { name: 'expense-report', args: '<office-code>',              desc: 'Bundle all draft expenses for an office into a report (XLSX in Drive)' },
];

// Returns the list of commands matching the current input, OR null if the
// autocomplete should be hidden (no leading slash, or user is past the
// command and into the argument).
function suggestSlashCommands(input: string): SlashSpec[] | null {
  if (!input.startsWith('/')) return null;
  // Once the user types a space, they're typing the argument — hide.
  if (input.includes(' ')) return null;
  const prefix = input.slice(1).toLowerCase();
  return SLASH_COMMANDS.filter(c => c.name.startsWith(prefix));
}

function parseSlashCommand(input: string): ParsedSlash | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  const m = trimmed.match(/^\/(new-clients|new-suppliers|clients|suppliers|products|expense-report|expenses|expense)(?:\s+([\s\S]+))?$/i);
  if (!m) return null;
  return { kind: m[1].toLowerCase() as SlashKind, arg: (m[2] || '').trim() };
}

// Parse "142 TWD taxi from airport" → { amount: 142, currency: 'TWD', description: 'taxi from airport' }
// Tolerant: amount can come with $ / NT$ / ¥, currency is best-effort.
function parseExpenseArgs(arg: string): { amount: number | null; currency: string; description: string } {
  const cleaned = arg.replace(/^[$¥₫฿]|NT\$/gi, '').trim();
  // Match leading number (with optional decimal)
  const m = cleaned.match(/^(\d+(?:\.\d+)?)\s+(\S+)\s+(.*)$/);
  if (!m) {
    // Maybe just number + description (no currency)
    const m2 = cleaned.match(/^(\d+(?:\.\d+)?)\s+(.*)$/);
    if (m2) return { amount: Number(m2[1]), currency: 'USD', description: m2[2].trim() };
    return { amount: null, currency: 'USD', description: arg };
  }
  return { amount: Number(m[1]), currency: m[2].toUpperCase().slice(0, 3), description: m[3].trim() };
}

async function runSlashCommand(
  slash: ParsedSlash,
  conversationId: string | null,
  opts: { onResearchStarted?: (taskId: string) => void } = {},
): Promise<string> {
  switch (slash.kind) {
    case 'new-clients':
    case 'new-suppliers': {
      if (!slash.arg || slash.arg.length < 5) {
        return 'Need a brief — e.g. `/' + slash.kind + ' canadian brake-pad importers, mid-size`. What country, product, and rough size are we looking for?';
      }
      const mode: ResearchTaskMode = slash.kind === 'new-clients' ? 'clients' : 'suppliers';
      const res = await startResearchTask(mode, slash.arg, conversationId ?? undefined);
      const task = res.data;
      if (task?.id && opts.onResearchStarted) opts.onResearchStarted(task.id);
      const what = mode === 'clients' ? 'client prospects' : 'suppliers';
      return `🔎 Researching new ${what}.\n\nBrief: "${slash.arg.slice(0, 200)}"\n\nThis runs in the background (5-15 min). I'll drop the results back here when done — push notification + email summary too. You can check progress in **AI Assistant → Research** or cancel from the same screen.\n\nTask ID: \`${task?.id ? task.id.slice(0, 8) : '—'}\``;
    }
    case 'clients': {
      const arg = slash.arg.trim();
      const res = await getCustomers(arg ? { search: arg, page: 1 } : { page: 1 });
      const rows = (res as any).data ?? (res as any).items ?? [];
      if (!rows.length) return arg ? `No customers match "${arg}".` : 'No customers found.';
      return formatRowList(rows.slice(0, 20), c => `**${c.companyName}**${c.country ? ` — ${c.country}` : ''}${c.email ? ` — ${c.email}` : ''}`);
    }
    case 'suppliers': {
      const arg = slash.arg.trim();
      const res = await getFactories(arg ? { search: arg, page: 1, limit: 20 } : { page: 1, limit: 20 });
      const rows = (res as any).data ?? (res as any).items ?? [];
      if (!rows.length) return arg ? `No suppliers match "${arg}".` : 'No suppliers found.';
      return formatRowList(rows.slice(0, 20), f => `**${f.companyName}**${f.country ? ` — ${f.country}` : ''}${f.specializations?.length ? ` (${f.specializations.slice(0, 3).join(', ')})` : ''}`);
    }
    case 'products': {
      const arg = slash.arg.trim();
      const res = await getProducts(arg ? { search: arg, page: 1, limit: 20 } : { page: 1, limit: 20 });
      const rows = (res as any).data ?? (res as any).items ?? [];
      if (!rows.length) return arg ? `No products match "${arg}".` : 'No products found.';
      return formatRowList(rows.slice(0, 20), p => `**${p.name || p.sku}**${p.sku ? ` (${p.sku})` : ''}${p.category?.name ? ` — ${p.category.name}` : ''}`);
    }

    case 'expense': {
      if (!slash.arg) {
        return 'Need an amount + currency + description — e.g. `/expense 142 TWD taxi from airport for LAU trip`.';
      }
      const { amount, currency, description } = parseExpenseArgs(slash.arg);
      if (amount == null) {
        return 'Could not parse the amount. Format: `/expense <amount> <currency> <description>`. Example: `/expense 580 USD hotel at LAU`.';
      }
      const created = await createExpense({
        category: 'Other',
        description,
        originalCurrency: currency,
        originalAmount: amount,
        submissionStatus: 'draft',
      });
      const e = created.data;
      return `✓ Logged: **${currency} ${amount.toLocaleString()}** — ${description}\n\nStatus: draft. Open the Expenses tab to attach a receipt or assign to a customer/office. Task ID: \`${e.id.slice(0, 8)}\``;
    }

    case 'expenses': {
      const arg = slash.arg.trim().toLowerCase();
      const params = arg === 'all' ? { limit: 20 } : { paid: false, limit: 20 };
      const res = await listExpenses(params);
      const rows = res.data || [];
      if (!rows.length) return arg === 'all' ? 'No expenses found.' : 'No unpaid expenses. 🎉';
      const lines = rows.map(e =>
        `- ${e.entryDate} · **${e.originalCurrency} ${Number(e.originalAmount).toLocaleString()}** — ${e.description || e.category}` +
        (e.submissionStatus !== 'draft' ? ` _(${e.submissionStatus})_` : ''),
      );
      return `${arg === 'all' ? 'All' : 'Unpaid'} expenses (last ${rows.length}):\n${lines.join('\n')}`;
    }

    case 'expense-report': {
      const officeArg = slash.arg.trim();
      if (!officeArg) {
        return 'Specify an office code — e.g. `/expense-report SOVERN_TW`. Run `/expenses` first to see what\'s pending.';
      }
      const officesRes = await listExpenseOffices();
      const offices = officesRes.data || [];
      const office = offices.find(o =>
        o.code.toLowerCase() === officeArg.toLowerCase() ||
        o.displayName.toLowerCase() === officeArg.toLowerCase(),
      );
      if (!office) {
        const list = offices.map(o => `${o.code} (${o.displayName})`).join(', ') || 'none registered yet';
        return `No office matches "${officeArg}". Available: ${list}.`;
      }
      if (!office.exportTemplateKey) {
        return `Office **${office.code}** has no export template set. Open Settings → Offices and pick one of: \`expense_to_alex_v2\`, \`inspector_travel_v2\`, \`custom_csv\`.`;
      }
      // Group all draft expenses for this office into a new submission, then
      // generate the report XLSX.
      const subRes = await createExpenseSubmission({ officeId: office.id });
      const sub = subRes.data;
      const repRes = await generateSubmissionReport(sub.id);
      const file = repRes.data?.driveFile;
      return `📑 Report generated for **${office.code}** using \`${repRes.data?.templateKey}\`.\n\n${file?.webViewLink ? `[Open in Drive](${file.webViewLink})` : `Drive file ID: \`${file?.id}\``}`;
    }
  }
}

function formatRowList<T>(rows: T[], render: (row: T) => string): string {
  return rows.map(r => '- ' + render(r)).join('\n');
}

// ─── Welcome suggestions (same set as admin portal) ───────────────────────────

const SUGGESTIONS = [
  { icon: '📊', text: 'Summarise my current pipeline' },
  { icon: '✉️',  text: 'Draft a follow-up email for my top lead' },
  { icon: '🌍', text: 'What are the correct Incoterms for a sea shipment?' },
  { icon: '📥', text: 'What triage items are waiting for my action?' },
  { icon: '🇪🇬', text: 'What is the status of the Egypt pipeline?' },
  { icon: '💰', text: 'How do I calculate landed cost for a shipment?' },
];

// ─── Conversation Row ─────────────────────────────────────────────────────────

function ConvRow({
  conv,
  onPress,
  onRename,
  onDelete,
}: {
  conv: AIConversation;
  onPress: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  function showActionMenu() {
    Alert.alert(
      conv.title,
      undefined,
      [
        { text: 'Rename', onPress: onRename },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Delete conversation',
      `Delete "${conv.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  }

  return (
    <TouchableOpacity
      style={styles.convRow}
      onPress={onPress}
      onLongPress={showActionMenu}
      activeOpacity={0.7}
    >
      <View style={styles.convAvatar}>
        <Text style={styles.convAvatarText}>✦</Text>
      </View>
      <View style={styles.convBody}>
        <Text style={styles.convTitle} numberOfLines={1}>{conv.title}</Text>
        <Text style={styles.convMeta}>
          {conv.messageCount} {conv.messageCount === 1 ? 'message' : 'messages'} · {formatAge(conv.lastMessageAt)}
        </Text>
      </View>
      <Text style={styles.convChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: AIMessage }) {
  // Dev Mode run-card variant: live polling card. Render its own component.
  if (msg.kind === 'devRun' && msg.runId) {
    return <DevRunCard runId={msg.runId} timestamp={msg.timestamp} />;
  }

  const isUser = msg.role === 'user';
  const isDevModeUser = isUser && msg.devMode;
  const displayText = isUser ? msg.content : stripMarkdown(msg.content);

  // Long-press → system share sheet with the bubble's text. iOS / Android
  // both surface "Copy" as a one-tap action there. This complements the
  // word-level selection that `selectable` already provides on the Text node.
  const handleLongPress = () => {
    Share.share({ message: displayText }).catch(() => {});
  };

  return (
    <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
      {!isUser && (
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>✦</Text>
        </View>
      )}
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={500}
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
          isDevModeUser && styles.bubbleUserDevMode,
        ]}
      >
        {isDevModeUser && (
          <Text style={styles.devModeBadgeText}>DEV MODE</Text>
        )}
        <Text selectable style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {displayText}
        </Text>
        {/* Attachments (item 3) — rendered below the message text. Image
            attachments could later show inline thumbnails; for now we list
            name + type so chat history is honest about what was sent. */}
        {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
          <View>
            {msg.attachments.map(a => (
              <View key={a.driveFileId} style={styles.bubbleAttachment}>
                <Text>{a.mimeType?.startsWith('image/') ? '🖼️' : '📄'}</Text>
                <Text style={styles.bubbleAttachmentText} numberOfLines={1}>{a.name}</Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
      <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
        {formatAge(msg.timestamp)}
      </Text>
    </View>
  );
}

// ─── DevRunCard ──────────────────────────────────────────────────────────────
// Live-polling card for an in-flight dev-mode run. Polls /dev-mode/runs/:id
// every 4s while non-terminal; renders status, branch, diff, error,
// clarification (with inline answer input), and PR link when done.

function devRunStatusLabel(s: DevModeRunStatus): string {
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
function devRunStatusColor(s: DevModeRunStatus): string {
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

function DevRunCard({ runId, timestamp }: { runId: string; timestamp: string }) {
  const [run, setRun] = useState<DevModeRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await getDevModeRun(runId);
      if (res.data) setRun(res.data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load run');
    }
  }, [runId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!run) return;
    if (!NON_TERMINAL_RUN.includes(run.status)) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [run, refresh]);

  async function submitAnswer() {
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      await answerDevModeClarification(runId, answer.trim());
      setAnswer('');
      await refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.bubbleWrap]}>
      <View style={styles.aiBadge}>
        <Text style={styles.aiBadgeText}>{'<>'}</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAI, styles.devRunCard]}>
        {error && <Text style={{ color: '#991b1b' }}>⚠️ {error}</Text>}
        {!error && !run && <Text style={{ color: '#64748b' }}>Starting dev-mode run...</Text>}
        {run && (
          <>
            <View style={styles.devRunStatusRow}>
              <View style={[styles.devRunPill, { backgroundColor: devRunStatusColor(run.status) + '22', borderColor: devRunStatusColor(run.status) }]}>
                <Text style={{ color: devRunStatusColor(run.status), fontWeight: '700', fontSize: 11 }}>
                  {devRunStatusLabel(run.status)}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
                turn {run.turnCount}/{run.maxTurns}
              </Text>
            </View>
            {run.branchName && (
              <Text style={styles.devRunMetaText} numberOfLines={1} ellipsizeMode="middle">
                branch: {run.branchName}
              </Text>
            )}
            {(run.linesAdded > 0 || run.linesDeleted > 0) && (
              <Text style={styles.devRunMetaText}>
                diff: +{run.linesAdded} / -{run.linesDeleted} across {run.filesChanged?.length || 0} files
              </Text>
            )}
            {run.errorMessage && (
              <View style={styles.devRunErrBox}>
                <Text style={styles.devRunErrText}>{run.errorMessage}</Text>
              </View>
            )}
            {run.status === 'awaiting_clarification' && run.clarificationQuestion && (
              <View style={styles.devRunClarifyBox}>
                <Text style={styles.devRunClarifyLabel}>AI is asking</Text>
                <Text style={styles.devRunClarifyText}>{run.clarificationQuestion}</Text>
                <TextInput
                  style={styles.devRunAnswerInput}
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Your answer..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  editable={!submitting}
                  autoCorrect
                  spellCheck
                  autoCapitalize="sentences"
                />
                <Pressable
                  style={[styles.devRunSubmit, (!answer.trim() || submitting) && { opacity: 0.5 }]}
                  onPress={submitAnswer}
                  disabled={!answer.trim() || submitting}
                >
                  <Text style={styles.devRunSubmitText}>{submitting ? '...' : 'Submit'}</Text>
                </Pressable>
              </View>
            )}
            {run.prUrl && (
              <Pressable
                style={styles.devRunPrBtn}
                onPress={() => {
                  if (run.prUrl) {
                    require('expo-linking').openURL(run.prUrl).catch(() => {});
                  }
                }}
              >
                <Text style={styles.devRunPrBtnText}>Review PR #{run.prNumber || '?'} →</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
      <Text style={styles.bubbleTime}>{formatAge(timestamp)}</Text>
    </View>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <View style={styles.bubbleWrap}>
      <View style={styles.aiBadge}>
        <Text style={styles.aiBadgeText}>✦</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
        <Text style={styles.typingText}>Thinking…</Text>
      </View>
    </View>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────

function WelcomeScreen({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <ScrollView
      contentContainerStyle={styles.welcomeScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.welcomeLogoWrap}>
        <Text style={styles.welcomeLogo}>✦</Text>
        <Text style={styles.welcomeTitle}>Sovern AI</Text>
        <Text style={styles.welcomeSub}>
          Your context-aware trade assistant. Ask about your pipeline, draft emails, or get trade advice.
        </Text>
      </View>
      <View style={styles.suggestionsGrid}>
        {SUGGESTIONS.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={styles.suggestionCard}
            onPress={() => onSuggestion(s.text)}
            activeOpacity={0.7}
          >
            <Text style={styles.suggestionIcon}>{s.icon}</Text>
            <Text style={styles.suggestionText}>{s.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AssistantScreen() {
  const { user } = useAuthStore();
  const isAuthorized = user?.role === 'super_admin';
  const isSuperAdmin = isAuthorized;
  const router = useRouter();

  // ── Dev Mode state (super_admin only, persisted in AsyncStorage) ───────────
  const [devMode, setDevMode] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(DEV_MODE_KEY).then(v => { if (v === '1') setDevMode(true); });
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(DEV_MODE_KEY, devMode ? '1' : '0');
  }, [devMode]);

  // ── Conversation list state ────────────────────────────────────────────────
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [loadingList, setLoadingList]     = useState(true);
  const [refreshingList, setRefreshingList] = useState(false);

  // ── Thread state ───────────────────────────────────────────────────────────
  const [activeConvId, setActiveConvId]   = useState<string | null>(null);
  const [activeTitle, setActiveTitle]     = useState('');
  const [messages, setMessages]           = useState<AIMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [isThinking, setIsThinking]       = useState(false);

  // Background-research task IDs awaiting completion. While non-empty,
  // the active conversation is polled every 8s so the runner's
  // "✅ research finished" message appears inline without manual refresh.
  // Persisted to AsyncStorage so polling resumes after app reload while
  // a task is still mid-flight.
  const [pendingResearch, setPendingResearch] = useState<string[]>([]);
  const pendingResearchHydratedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PENDING_RESEARCH_KEY).then((raw) => {
      if (cancelled) return;
      if (raw) {
        try {
          const ids = JSON.parse(raw);
          if (Array.isArray(ids) && ids.length > 0) {
            setPendingResearch(ids.filter((x) => typeof x === 'string'));
          }
        } catch (_) { /* ignored */ }
      }
      pendingResearchHydratedRef.current = true;
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!pendingResearchHydratedRef.current) return;
    if (pendingResearch.length > 0) {
      AsyncStorage.setItem(PENDING_RESEARCH_KEY, JSON.stringify(pendingResearch));
    } else {
      AsyncStorage.removeItem(PENDING_RESEARCH_KEY);
    }
  }, [pendingResearch]);

  const activeConvIdRef = useRef<string | null>(null);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => {
    if (pendingResearch.length === 0) return;
    let cancelled = false;

    const tick = async () => {
      const convId = activeConvIdRef.current;
      if (convId && convId !== '__new__') {
        try {
          const data = await aiGetConversation(convId);
          if (!cancelled) {
            setMessages(prev => (data.messages.length > prev.length ? data.messages : prev));
          }
        } catch (_) { /* non-fatal */ }
      }
      const stillPending: string[] = [];
      for (const taskId of pendingResearch) {
        try {
          const r = await getResearchTask(taskId);
          const status = (r as any)?.data?.status;
          if (status && !['completed', 'failed', 'cancelled'].includes(status)) {
            stillPending.push(taskId);
          }
        } catch (_) {
          stillPending.push(taskId);
        }
      }
      if (!cancelled && stillPending.length !== pendingResearch.length) {
        setPendingResearch(stillPending);
      }
    };

    tick();
    const interval = setInterval(tick, 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [pendingResearch]);

  // ── Compose state ──────────────────────────────────────────────────────────
  const [draft, setDraft]   = useState('');
  const [sending, setSending] = useState(false);

  // ── Attachment state (item 3) ──────────────────────────────────────────────
  // Files the user has picked but not yet sent. Each shown as a chip above
  // the composer; tap × to remove. On send, the array is passed to aiChat
  // and then cleared. uploading[] tracks per-attachment in-flight uploads
  // so the chip can show a spinner.
  const [pendingAttachments, setPendingAttachments] = useState<AIAttachment[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // ── Rename modal state ─────────────────────────────────────────────────────
  const [renamingConv, setRenamingConv] = useState<AIConversation | null>(null);
  const [renameDraft, setRenameDraft]   = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  const listRef = useRef<FlatList>(null);

  // ── Load conversation list ─────────────────────────────────────────────────

  const loadConversations = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshingList(true) : setLoadingList(true);
      const data = await aiListConversations();
      setConversations(data);
    } catch (err: any) {
      console.error('[AI/list]', err.message);
    } finally {
      setLoadingList(false);
      setRefreshingList(false);
    }
  }, []);

  useEffect(() => {
    // Skip loading conversations for unauthorized users — and for the
    // brief render between "user becomes null on logout" and the auth
    // guard's redirect to /login. Avoids a 403 burst during sign-out.
    if (!isAuthorized) return;
    loadConversations();
  }, [loadConversations, isAuthorized]);

  // ── Open conversation ──────────────────────────────────────────────────────

  async function openConversation(conv: AIConversation) {
    setActiveConvId(conv.id);
    setActiveTitle(conv.title);
    setMessages([]);
    setLoadingThread(true);
    try {
      const data = await aiGetConversation(conv.id);
      setMessages(data.messages);
    } catch (err: any) {
      console.error('[AI/thread]', err.message);
    } finally {
      setLoadingThread(false);
    }
  }

  function startNewConversation() {
    setActiveConvId(null);          // null = new conversation, not yet created
    setActiveTitle('New conversation');
    setMessages([]);
    // use a sentinel to indicate we're in "new thread" mode
    setActiveConvId('__new__');
  }

  function closeThread() {
    setActiveConvId(null);
    setMessages([]);
    setDraft('');
    loadConversations();
  }

  // ── Attachment handlers (item 3) ───────────────────────────────────────────

  function showAttachmentOptions() {
    if (pendingAttachments.length >= 5) {
      setAttachmentError('Max 5 attachments per message. Send these first.');
      return;
    }
    Alert.alert(
      'Attach a file',
      'What would you like to share with the AI?',
      [
        { text: 'Take photo',     onPress: () => pickFromCamera() },
        { text: 'Choose photo',   onPress: () => pickFromLibrary() },
        { text: 'Choose file',    onPress: () => pickDocument() },
        { text: 'Cancel',         style: 'cancel' },
      ],
    );
  }

  async function pickFromCamera() {
    try {
      const perms = await ImagePicker.requestCameraPermissionsAsync();
      if (!perms.granted) {
        setAttachmentError('Camera permission denied. Enable in Settings.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.8,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await uploadAndAdd(result.assets[0].uri,
        result.assets[0].fileName || `photo-${Date.now()}.jpg`,
        result.assets[0].mimeType || 'image/jpeg');
    } catch (err: any) {
      setAttachmentError(err?.message || 'Camera failed');
    }
  }

  async function pickFromLibrary() {
    try {
      const perms = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perms.granted) {
        setAttachmentError('Photo library permission denied. Enable in Settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
        exif: false,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await uploadAndAdd(result.assets[0].uri,
        result.assets[0].fileName || `image-${Date.now()}.jpg`,
        result.assets[0].mimeType || 'image/jpeg');
    } catch (err: any) {
      setAttachmentError(err?.message || 'Library access failed');
    }
  }

  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // Whitelist matches the backend's multer fileFilter.
        type: [
          'image/*',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
        ],
        multiple: false,
        copyToCacheDirectory: true, // ensure we have a stable file:// URI to upload from
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      await uploadAndAdd(a.uri, a.name, a.mimeType || 'application/octet-stream');
    } catch (err: any) {
      setAttachmentError(err?.message || 'Document picker failed');
    }
  }

  async function uploadAndAdd(uri: string, name: string, mimeType: string) {
    setAttachmentError(null);
    setUploadingCount(c => c + 1);
    try {
      const att = await uploadAttachment({ uri, name, mimeType });
      setPendingAttachments(prev => [...prev, att]);
    } catch (err: any) {
      setAttachmentError(err?.message || 'Upload failed');
    } finally {
      setUploadingCount(c => Math.max(0, c - 1));
    }
  }

  function removePendingAttachment(driveFileId: string) {
    setPendingAttachments(prev => prev.filter(a => a.driveFileId !== driveFileId));
  }

  // ── Delete conversation ────────────────────────────────────────────────────

  async function handleDelete(convId: string) {
    try {
      await aiDeleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not delete conversation.');
    }
  }

  // ── Rename conversation ────────────────────────────────────────────────────

  function openRename(conv: AIConversation) {
    setRenamingConv(conv);
    setRenameDraft(conv.title);
  }

  function closeRename() {
    setRenamingConv(null);
    setRenameDraft('');
    setRenameSaving(false);
  }

  async function submitRename() {
    if (!renamingConv) return;
    const next = renameDraft.trim();
    if (!next || next === renamingConv.title) {
      closeRename();
      return;
    }
    setRenameSaving(true);
    try {
      await aiRenameConversation(renamingConv.id, next);
      setConversations(prev =>
        prev.map(c => (c.id === renamingConv.id ? { ...c, title: next } : c)),
      );
      // If the renamed thread is currently open, keep the header in sync
      if (activeConvId === renamingConv.id) setActiveTitle(next);
      closeRename();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not rename conversation.');
      setRenameSaving(false);
    }
  }

  // ── Send message ───────────────────────────────────────────────────────────

  async function handleSend(text?: string) {
    const body = (text ?? draft).trim();
    if (!body || sending) return;
    setDraft('');
    setSending(true);

    // Slash-command branch: intercept /new-clients, /new-suppliers (Tier 2
    // background research), and /clients, /suppliers, /products (instant
    // ERP lookups). Handled client-side so the AI never sees them and the
    // routing is predictable. Falls through to /ai/chat for anything else.
    const slash = parseSlashCommand(body);
    if (slash) {
      const userMsg: AIMessage = {
        role: 'user',
        content: body,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      try {
        const reply = await runSlashCommand(slash, activeConvId, {
          onResearchStarted: (taskId: string) => {
            setPendingResearch(prev => (prev.includes(taskId) ? prev : [...prev, taskId]));
          },
        });
        // /new-X starts a background task; the runner's notifier will append
        // the result back to this conversation when it lands. /X commands
        // return the result immediately.
        const assistantMsg: AIMessage = {
          role: 'assistant',
          content: reply,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMsg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
      } catch (err: any) {
        const errMsg: AIMessage = {
          role: 'assistant',
          content: '⚠️ ' + (err.message ?? 'Slash command failed.'),
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errMsg]);
      } finally {
        setSending(false);
      }
      return;
    }

    // Dev Mode branch (super_admin only): spawn a sandboxed code-change
    // run instead of calling /ai/chat. Push a live DevRunCard message
    // into the thread that polls the run state.
    if (devMode && isSuperAdmin) {
      const userMsg: AIMessage = {
        role: 'user',
        content: body,
        timestamp: new Date().toISOString(),
        devMode: true,
      };
      setMessages(prev => [...prev, userMsg]);
      try {
        const res = await startDevModeRun(body);
        const run = res.data;
        if (run) {
          const cardMsg: AIMessage = {
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            kind: 'devRun',
            runId: run.id,
          };
          setMessages(prev => [...prev, cardMsg]);
        }
      } catch (err: any) {
        const errMsg: AIMessage = {
          role: 'assistant',
          content: '⚠️ ' + (err.message ?? 'Could not start dev-mode run.'),
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errMsg]);
      } finally {
        setSending(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
      }
      return;
    }

    // Snapshot attachments for this send + clear pending so the next
    // message starts empty even if the network call is slow.
    const attachmentsForSend = pendingAttachments;
    setPendingAttachments([]);

    // Optimistic user bubble
    const userMsg: AIMessage = {
      role: 'user',
      content: body,
      timestamp: new Date().toISOString(),
      ...(attachmentsForSend.length > 0 ? { attachments: attachmentsForSend } : {}),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const convId = activeConvId === '__new__' ? undefined : (activeConvId ?? undefined);
      const res = await aiChat(body, convId, attachmentsForSend.length > 0 ? attachmentsForSend : undefined);

      if (activeConvId === '__new__' || !activeConvId) {
        setActiveConvId(res.conversationId);
        setActiveTitle(res.title);
      }

      const assistantMsg: AIMessage = {
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not reach the AI assistant.');
      setMessages(prev => prev.filter(m => m !== userMsg));
      setDraft(body);
      // Restore the attachments to pending so the user can retry without
      // re-uploading.
      setPendingAttachments(attachmentsForSend);
    } finally {
      setSending(false);
      setIsThinking(false);
    }
  }

  // ── Render: access gate (must come AFTER all hooks above to avoid
  //    the "fewer hooks than expected" rules-of-hooks violation that
  //    fires on logout when user.role transitions super_admin → null).

  if (!isAuthorized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center',
        padding: 32, backgroundColor: COLORS.cream }}>
        <Text style={{ fontSize: 32, marginBottom: 16 }}>🔒</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.ink,
          textAlign: 'center', marginBottom: 8 }}>
          Access restricted
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 20 }}>
          The AI assistant is available to administrators only.
        </Text>
      </View>
    );
  }

  // ── Render: conversation list ──────────────────────────────────────────────

  if (activeConvId === null) {
    if (loadingList) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.forest} />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {/* New conversation button */}
        <TouchableOpacity
          style={styles.newConvBtn}
          onPress={startNewConversation}
          activeOpacity={0.85}
        >
          <Text style={styles.newConvBtnText}>✦  New conversation</Text>
        </TouchableOpacity>

        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <ConvRow
              conv={item}
              onPress={() => openConversation(item)}
              onRename={() => openRename(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshingList}
              onRefresh={() => loadConversations(true)}
              tintColor={COLORS.forest}
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyList}>
              <Text style={styles.emptyListIcon}>✦</Text>
              <Text style={styles.emptyListTitle}>No conversations yet</Text>
              <Text style={styles.emptyListText}>
                Tap "New conversation" to get started.
              </Text>
            </View>
          )}
          contentContainerStyle={conversations.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
        />

        {/* Rename modal */}
        <Modal
          visible={!!renamingConv}
          transparent
          animationType="fade"
          onRequestClose={closeRename}
        >
          <KeyboardAvoidingView
            style={styles.renameBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.renameCard}>
              <Text style={styles.renameTitle}>Rename conversation</Text>
              <TextInput
                style={styles.renameInput}
                value={renameDraft}
                onChangeText={setRenameDraft}
                placeholder="Conversation title"
                placeholderTextColor={COLORS.muted}
                autoFocus
                maxLength={200}
                returnKeyType="done"
                onSubmitEditing={submitRename}
                editable={!renameSaving}
              />
              <View style={styles.renameActions}>
                <TouchableOpacity
                  style={styles.renameBtnGhost}
                  onPress={closeRename}
                  disabled={renameSaving}
                >
                  <Text style={styles.renameBtnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.renameBtnPrimary,
                    (!renameDraft.trim() || renameSaving) && styles.renameBtnDisabled,
                  ]}
                  onPress={submitRename}
                  disabled={!renameDraft.trim() || renameSaving}
                >
                  <Text style={styles.renameBtnPrimaryText}>
                    {renameSaving ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  // ── Render: thread view ────────────────────────────────────────────────────

  const isNewThread = activeConvId === '__new__';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Thread header */}
      <View style={styles.threadHeader}>
        <TouchableOpacity onPress={closeThread} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.threadTitle} numberOfLines={1}>
          {isNewThread ? 'New conversation' : activeTitle}
        </Text>
        {isSuperAdmin ? (
          <Pressable
            style={[styles.devModeToggle, devMode && styles.devModeToggleOn]}
            onPress={() => setDevMode(v => !v)}
            hitSlop={6}
          >
            <Text style={[styles.devModeToggleText, devMode && styles.devModeToggleTextOn]}>
              {'</>'} {devMode ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 56 }} />
        )}
      </View>

      {/* View runs history link (super_admin only) */}
      {isSuperAdmin && (
        <Pressable
          onPress={() => router.push('/dev-runs')}
          style={styles.devRunsLink}
        >
          <Text style={styles.devRunsLinkText}>View Dev Mode runs history →</Text>
        </Pressable>
      )}

      {loadingThread ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.forest} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          // STABLE keys based on timestamp+role so React doesn't tear down
          // existing bubbles when a new message is appended. Index-based keys
          // re-mount every visible bubble on each append, which kills any
          // in-progress text selection.
          keyExtractor={(item) => `${item.timestamp}-${item.role}`}
          renderItem={({ item }) => <MsgBubble msg={item} />}
          ListHeaderComponent={messages.length === 0 ? (
            <WelcomeScreen onSuggestion={(text) => handleSend(text)} />
          ) : null}
          ListFooterComponent={isThinking ? <TypingIndicator /> : null}
          contentContainerStyle={messages.length === 0 ? { flex: 1 } : { paddingVertical: 12 }}
          onContentSizeChange={() => {
            if (messages.length > 0) listRef.current?.scrollToEnd({ animated: false });
          }}
        />
      )}

      {/* Slash command autocomplete — appears when input starts with '/' and
          there's no space yet. Tap a row to insert the command + a trailing
          space (cursor now ready for the argument). */}
      {(() => {
        const suggestions = suggestSlashCommands(draft);
        if (!suggestions || suggestions.length === 0) return null;
        return (
          <View style={styles.slashPanel}>
            {suggestions.map(c => (
              <TouchableOpacity
                key={c.name}
                onPress={() => setDraft('/' + c.name + ' ')}
                style={styles.slashRow}
              >
                <Text style={styles.slashCmd}>/{c.name}</Text>
                <Text style={styles.slashArgs}>{c.args}</Text>
                <Text style={styles.slashDesc} numberOfLines={1}>{c.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      })()}

      {/* Pending attachments — chips above the composer. Tap × to remove. */}
      {(pendingAttachments.length > 0 || uploadingCount > 0) && (
        <View style={styles.attachmentRow}>
          {pendingAttachments.map(a => (
            <View key={a.driveFileId} style={styles.attachmentChip}>
              {a.mimeType?.startsWith('image/') && a.thumbnailUrl
                ? <Text style={styles.attachmentChipIcon}>🖼️</Text>
                : <Text style={styles.attachmentChipIcon}>📄</Text>}
              <Text style={styles.attachmentChipText} numberOfLines={1}>{a.name}</Text>
              <Pressable
                onPress={() => removePendingAttachment(a.driveFileId)}
                hitSlop={8}
              >
                <Text style={styles.attachmentChipRemove}>×</Text>
              </Pressable>
            </View>
          ))}
          {uploadingCount > 0 && (
            <View style={styles.attachmentChip}>
              <ActivityIndicator size="small" color={COLORS.forest} />
              <Text style={styles.attachmentChipText}>uploading…</Text>
            </View>
          )}
        </View>
      )}
      {attachmentError && (
        <View style={styles.inlineErrorBar}>
          <Text style={styles.inlineErrorText} numberOfLines={2}>⚠️ {attachmentError}</Text>
          <Pressable onPress={() => setAttachmentError(null)}>
            <Text style={styles.inlineErrorDismiss}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Compose bar */}
      <View style={styles.compose}>
        {/* 📎 attach a file (camera / library / document picker). */}
        <Pressable
          style={styles.micBtn}
          onPress={showAttachmentOptions}
          disabled={sending || uploadingCount > 0}
          accessibilityLabel="Attach a file"
        >
          <Text style={styles.micBtnText}>📎</Text>
        </Pressable>
        <TextInput
          style={styles.composeInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={devMode && isSuperAdmin
            ? 'Describe a code change for the dev agent…'
            : 'Ask Sovern AI…'}
          placeholderTextColor={COLORS.muted}
          multiline
          maxLength={4000}
          returnKeyType="default"
          editable={!sending}
          // Phase 4.5, C23: prose input. Keep native autocorrect + spellcheck on.
          autoCorrect
          spellCheck
          autoCapitalize="sentences"
        />
        <Pressable
          style={[
            styles.sendBtn,
            (!draft.trim() || sending) && styles.sendBtnDisabled,
            devMode && isSuperAdmin && styles.sendBtnDevMode,
          ]}
          onPress={() => handleSend()}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.sendBtnText}>{sending ? '…' : '↑'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // New conv button
  newConvBtn: {
    margin: 16,
    backgroundColor: COLORS.forest,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  newConvBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Conversation rows
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  convAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.forest + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  convAvatarText: { fontSize: 18, color: COLORS.forest },
  convBody:       { flex: 1 },
  convTitle:      { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  convMeta:       { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  convChevron:    { fontSize: 20, color: COLORS.muted },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 70 },

  // Empty list
  emptyList:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyListIcon:  { fontSize: 48, color: COLORS.forest },
  emptyListTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptyListText:  { fontSize: 14, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 32 },

  // Thread header
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.forest,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backBtn:     { width: 56 },
  backText:    { color: '#fff', fontWeight: '600', fontSize: 14 },
  threadTitle: { flex: 1, textAlign: 'center', color: '#fff', fontWeight: '700', fontSize: 16 },

  // Welcome
  welcomeScroll: { padding: 24, flexGrow: 1 },
  welcomeLogoWrap: { alignItems: 'center', marginBottom: 32, marginTop: 16 },
  welcomeLogo:   { fontSize: 44, color: COLORS.forest },
  welcomeTitle:  { fontSize: 22, fontWeight: '700', color: COLORS.ink, marginTop: 8 },
  welcomeSub:    { fontSize: 14, color: COLORS.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  suggestionsGrid: { gap: 10 },
  suggestionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionIcon: { fontSize: 20 },
  suggestionText: { flex: 1, fontSize: 14, color: COLORS.ink, lineHeight: 20 },

  // Message bubbles
  bubbleWrap: {
    paddingHorizontal: 14,
    marginVertical: 5,
    alignItems: 'flex-start',
    gap: 4,
  },
  bubbleWrapUser: { alignItems: 'flex-end' },
  aiBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.forest + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  aiBadgeText: { fontSize: 12, color: COLORS.forest },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleAI:       { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  bubbleUser:     { backgroundColor: COLORS.forest, borderBottomRightRadius: 4 },
  bubbleText:     { fontSize: 15, color: COLORS.ink, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  bubbleTime:     { fontSize: 10, color: COLORS.muted, marginLeft: 4 },
  bubbleTimeUser: { marginLeft: 0, marginRight: 4 },

  // Typing indicator
  typingBubble: { paddingVertical: 12 },
  typingText:   { fontSize: 14, color: COLORS.muted, fontStyle: 'italic' },

  // Compose
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  composeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: COLORS.ink,
    maxHeight: 120,
    backgroundColor: COLORS.cream,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },

  // micBtn was originally for the voice mic button, now reused for the
  // attachment 📎 button. Voice was dropped from mobile (Expo Go limitation).
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  micBtnText: { fontSize: 18 },

  // Generic error-strip styles used by the attachmentError bar (and any
  // future inline error). Was named voiceError* before mobile voice was
  // removed; renamed to be content-agnostic.
  inlineErrorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderTopWidth: 1,
    borderTopColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineErrorText: { color: '#7f1d1d', fontSize: 12, flex: 1, marginRight: 8 },
  inlineErrorDismiss: { color: '#7f1d1d', fontSize: 18, paddingHorizontal: 6 },

  slashPanel: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    maxHeight: 220,
  },
  slashRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  slashCmd: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.forest,
    marginRight: 8,
  },
  slashArgs: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: COLORS.muted,
    marginRight: 12,
  },
  slashDesc: { fontSize: 12, color: COLORS.ink, flex: 1 },

  attachmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.cream,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 4,
    maxWidth: 180,
  },
  attachmentChipIcon: { fontSize: 14 },
  attachmentChipText: { fontSize: 12, color: COLORS.ink, flexShrink: 1 },
  attachmentChipRemove: {
    fontSize: 18,
    color: COLORS.muted,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  bubbleAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  bubbleAttachmentText: { fontSize: 12, color: COLORS.ink, flex: 1 },

  // Rename modal
  renameBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  renameCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  renameTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  renameInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: COLORS.cream,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  renameBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  renameBtnGhostText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  renameBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: COLORS.forest,
  },
  renameBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  renameBtnDisabled: { backgroundColor: COLORS.border },

  // ── Dev Mode ───────────────────────────────────────────────────────────────
  devModeToggle: {
    width: 56,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#ffffff55',
    alignItems: 'center',
  },
  devModeToggleOn: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  devModeToggleText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  devModeToggleTextOn: { color: COLORS.forest },

  devRunsLink: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: COLORS.forest + '12',
  },
  devRunsLinkText: { color: COLORS.forest, fontSize: 12, fontWeight: '600' },

  bubbleUserDevMode: { backgroundColor: '#0f172a' },
  devModeBadgeText: {
    color: '#ffffffaa', fontSize: 9, fontWeight: '700', letterSpacing: 0.6,
    marginBottom: 2,
  },

  sendBtnDevMode: { backgroundColor: '#0f172a' },

  devRunCard: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    minWidth: 240,
  },
  devRunStatusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  devRunPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 99, borderWidth: 1,
  },
  devRunMetaText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  devRunErrBox: {
    marginTop: 6, padding: 8,
    backgroundColor: '#fef2f2', borderRadius: 6,
  },
  devRunErrText: { color: '#991b1b', fontSize: 12 },
  devRunClarifyBox: {
    marginTop: 8, padding: 10,
    backgroundColor: '#fef3c7', borderRadius: 6,
  },
  devRunClarifyLabel: {
    color: '#854d0e', fontSize: 10, fontWeight: '700',
    letterSpacing: 0.6, marginBottom: 4,
  },
  devRunClarifyText: { color: '#854d0e', fontSize: 13, marginBottom: 6 },
  devRunAnswerInput: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 13, color: COLORS.ink, minHeight: 40,
  },
  devRunSubmit: {
    marginTop: 6, alignSelf: 'flex-start',
    backgroundColor: '#0f172a', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  devRunSubmitText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  devRunPrBtn: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: '#0f172a', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  devRunPrBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
