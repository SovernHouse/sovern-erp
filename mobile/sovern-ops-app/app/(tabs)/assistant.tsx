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
  Platform, Pressable, Alert, ScrollView, Modal,
} from 'react-native';
import {
  aiChat, aiListConversations, aiGetConversation, aiDeleteConversation,
  aiRenameConversation,
  type AIConversation, type AIMessage,
} from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS } from '../../src/constants/config';

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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  const isUser = msg.role === 'user';
  const displayText = isUser ? msg.content : stripMarkdown(msg.content);

  return (
    <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
      {!isUser && (
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>✦</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <Text selectable style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {displayText}
        </Text>
      </View>
      <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
        {formatAge(msg.timestamp)}
      </Text>
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

  // ── Compose state ──────────────────────────────────────────────────────────
  const [draft, setDraft]   = useState('');
  const [sending, setSending] = useState(false);

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

    // Optimistic user bubble
    const userMsg: AIMessage = {
      role: 'user',
      content: body,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const convId = activeConvId === '__new__' ? undefined : (activeConvId ?? undefined);
      const res = await aiChat(body, convId);

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
        <View style={{ width: 56 }} />
      </View>

      {loadingThread ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.forest} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
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

      {/* Compose bar */}
      <View style={styles.compose}>
        <TextInput
          style={styles.composeInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask Sovern AI…"
          placeholderTextColor={COLORS.muted}
          multiline
          maxLength={4000}
          returnKeyType="default"
          editable={!sending}
        />
        <Pressable
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
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
});
