// ─── ChatterSection ────────────────────────────────────────────────────────
// Odoo-style message thread for mobile detail screens.
// Drop below any SectionHeader in a ScrollView:
//
//   <ChatterSection entityType="Quotation" entityId={id} />
//
// Loads messages on mount, shows system events as slim rows and comments as
// chat bubbles, lets the user post new notes.

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../constants/config';
import { getChatterMessages, postChatterMessage, type ChatterMessage } from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Taipei' });
}

function initials(name = ''): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

const isSystemEvent = (type: string) =>
  !['comment', 'file_attachment'].includes(type);

// ─── Sub-components ───────────────────────────────────────────────────────

function SystemRow({ msg }: { msg: ChatterMessage }) {
  return (
    <View style={styles.systemRow}>
      <View style={styles.systemDot} />
      <Text style={styles.systemBody} numberOfLines={3}>{msg.body}</Text>
      <Text style={styles.systemTime}>{timeAgo(msg.createdAt)}</Text>
    </View>
  );
}

function CommentBubble({ msg }: { msg: ChatterMessage }) {
  const name = msg.authorName || 'System';
  const ini = initials(name);
  return (
    <View style={styles.bubbleRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{ini}</Text>
      </View>
      <View style={styles.bubbleBody}>
        <View style={styles.bubbleMeta}>
          <Text style={styles.bubbleAuthor}>{name}</Text>
          <Text style={styles.bubbleTime}>{timeAgo(msg.createdAt)}</Text>
        </View>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{msg.body}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

interface Props {
  entityType: string;
  entityId: string;
}

export default function ChatterSection({ entityType, entityId }: Props) {
  const [messages, setMessages] = useState<ChatterMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [body, setBody]         = useState('');
  const [sending, setSending]   = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getChatterMessages(entityType, entityId);
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      // non-fatal — show empty thread
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const msg = await postChatterMessage(entityType, entityId, trimmed);
      if (msg) setMessages(prev => [...prev, msg as ChatterMessage]);
      setBody('');
    } catch {
      // silent — user can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={120}
    >
      {/* Thread */}
      <View style={styles.thread}>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.forest} style={{ margin: 16 }} />
        ) : messages.length === 0 ? (
          <Text style={styles.empty}>No messages yet — add a note below.</Text>
        ) : (
          messages.map(msg =>
            isSystemEvent(msg.messageType)
              ? <SystemRow key={msg.id} msg={msg} />
              : <CommentBubble key={msg.id} msg={msg} />
          )
        )}
      </View>

      {/* Compose */}
      <View style={styles.compose}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write a note…"
          placeholderTextColor={COLORS.muted}
          multiline
          style={styles.input}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!body.trim() || sending}
          style={[styles.sendBtn, (!body.trim() || sending) && styles.sendBtnDisabled]}
          activeOpacity={0.7}
        >
          {sending
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Text style={styles.sendBtnText}>Send</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  thread: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 56,
  },
  empty: {
    padding: 16,
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
  },

  // System events
  systemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  systemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.muted,
    marginTop: 5,
    flexShrink: 0,
  },
  systemBody: {
    flex: 1,
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
  },
  systemTime: {
    fontSize: 11,
    color: COLORS.muted,
    flexShrink: 0,
    marginTop: 1,
  },

  // Comment bubbles
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.forest + '20',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.forest,
  },
  bubbleBody: { flex: 1 },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  bubbleAuthor: { fontSize: 13, fontWeight: '600', color: COLORS.ink },
  bubbleTime:   { fontSize: 11, color: COLORS.muted },
  bubble: {
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    borderTopLeftRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleText: { fontSize: 13, color: COLORS.ink, lineHeight: 19 },

  // Compose row
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.ink,
    maxHeight: 100,
    minHeight: 42,
  },
  sendBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.forest + '60',
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
