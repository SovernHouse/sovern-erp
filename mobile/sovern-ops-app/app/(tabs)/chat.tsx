// ─── Chat Screen ─────────────────────────────────────────────────────────────
// Internal team chat — room list + message thread in a single screen.
// REST-based (polling on focus); socket.io integration can be added later.
// Maps to /api/chat/rooms and /api/chat/rooms/:id/messages.

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, Pressable,
} from 'react-native';
import {
  getChatRooms, getChatRoomMessages, sendChatMessage, markChatRoomRead,
  type ChatRoom, type ChatMessage,
} from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Taipei' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Taipei' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Taipei' });
}

function senderDisplay(msg: ChatMessage): string {
  if (msg.sender?.firstName || msg.sender?.lastName) {
    return [msg.sender.firstName, msg.sender.lastName].filter(Boolean).join(' ');
  }
  return msg.sender?.name ?? 'Unknown';
}

function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ─── Room List ────────────────────────────────────────────────────────────────

function RoomRow({ room, onPress }: { room: ChatRoom; onPress: () => void }) {
  const displayName = room.type === 'dm' && room.dmUser
    ? room.dmUser.name
    : (room.name ?? 'Unnamed');
  const icon = room.type === 'channel' ? '#' : room.type === 'dm' ? '👤' : '🌐';
  const hasUnread = (room.unreadCount ?? 0) > 0;

  return (
    <TouchableOpacity style={styles.roomRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.roomAvatar, hasUnread && styles.roomAvatarUnread]}>
        <Text style={styles.roomAvatarText}>
          {room.type === 'channel' ? '#' : initials(displayName)}
        </Text>
      </View>

      <View style={styles.roomBody}>
        <View style={styles.roomHeader}>
          <Text style={[styles.roomName, hasUnread && styles.roomNameUnread]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.roomTime}>{formatTime(room.lastMessageAt ?? undefined)}</Text>
        </View>
        {room.lastMessageBody ? (
          <Text style={[styles.roomPreview, hasUnread && styles.roomPreviewUnread]} numberOfLines={1}>
            {room.lastMessageBody}
          </Text>
        ) : (
          <Text style={styles.roomPreviewEmpty}>No messages yet</Text>
        )}
      </View>

      {hasUnread && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>
            {room.unreadCount > 99 ? '99+' : room.unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) {
  if (msg.deletedAt) {
    return (
      <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
        <Text style={styles.deletedText}>Message deleted</Text>
      </View>
    );
  }
  const name = senderDisplay(msg);

  return (
    <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
      {!isMe && <Text style={styles.bubbleSender}>{name}</Text>}
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text selectable style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
          {msg.body ?? ''}
        </Text>
      </View>
      <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
        {formatTime(msg.createdAt)}
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [refreshingRooms, setRefreshingRooms] = useState(false);

  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [refreshingMsgs, setRefreshingMsgs] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef<FlatList>(null);

  // ── Room list ──────────────────────────────────────────────────────────────

  const loadRooms = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshingRooms(true) : setLoadingRooms(true);
      const data = await getChatRooms();
      setRooms(data);
    } catch (err: any) {
      console.error('[Chat/rooms]', err.message);
    } finally {
      setLoadingRooms(false);
      setRefreshingRooms(false);
    }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // ── Message thread ─────────────────────────────────────────────────────────

  const loadMessages = useCallback(async (room: ChatRoom, isRefresh = false) => {
    try {
      isRefresh ? setRefreshingMsgs(true) : setLoadingMsgs(true);
      const data = await getChatRoomMessages(room.id);
      setMessages(data);
      // Mark as read
      await markChatRoomRead(room.id).catch(() => {});
      // Update unread count locally
      setRooms(prev =>
        prev.map(r => r.id === room.id ? { ...r, unreadCount: 0 } : r)
      );
    } catch (err: any) {
      console.error('[Chat/messages]', err.message);
    } finally {
      setLoadingMsgs(false);
      setRefreshingMsgs(false);
    }
  }, []);

  function openRoom(room: ChatRoom) {
    setActiveRoom(room);
    setMessages([]);
    setDraft('');
    loadMessages(room);
  }

  function closeRoom() {
    setActiveRoom(null);
    setMessages([]);
    loadRooms();
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!activeRoom || !draft.trim() || sending) return;
    const body = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const msg = await sendChatMessage(activeRoom.id, body);
      setMessages(prev => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      console.error('[Chat/send]', err.message);
      setDraft(body); // restore on failure
    } finally {
      setSending(false);
    }
  }

  // ── Render: rooms ──────────────────────────────────────────────────────────

  if (!activeRoom) {
    if (loadingRooms) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.forest} />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <FlatList
          data={rooms}
          keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <RoomRow room={item} onPress={() => openRoom(item)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshingRooms}
              onRefresh={() => loadRooms(true)}
              tintColor={COLORS.forest}
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🗨️</Text>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Start a conversation from the web ERP.
              </Text>
            </View>
          )}
          contentContainerStyle={rooms.length === 0 ? { flex: 1 } : { paddingBottom: 16 }}
        />
      </View>
    );
  }

  // ── Render: message thread ─────────────────────────────────────────────────

  const displayName = activeRoom.type === 'dm' && activeRoom.dmUser
    ? activeRoom.dmUser.name
    : (activeRoom.name ?? 'Chat');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Thread header */}
      <View style={styles.threadHeader}>
        <TouchableOpacity onPress={closeRoom} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.threadTitle} numberOfLines={1}>{displayName}</Text>
        <View style={{ width: 56 }} />
      </View>

      {loadingMsgs ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.forest} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => (
            <MessageBubble msg={item} isMe={item.isMe ?? false} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshingMsgs}
              onRefresh={() => loadMessages(activeRoom, true)}
              tintColor={COLORS.forest}
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>Be the first to say something.</Text>
            </View>
          )}
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
          placeholder="Message..."
          placeholderTextColor={COLORS.muted}
          multiline
          maxLength={2000}
          returnKeyType="default"
          autoCorrect
          spellCheck
          autoCapitalize="sentences"
        />
        <Pressable
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
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

  // Room list
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  roomAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomAvatarUnread: { backgroundColor: COLORS.forest + '22' },
  roomAvatarText: { fontSize: 16, fontWeight: '700', color: COLORS.forest },
  roomBody: { flex: 1 },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  roomName: { fontSize: 15, fontWeight: '500', color: COLORS.ink, flex: 1 },
  roomNameUnread: { fontWeight: '700' },
  roomTime: { fontSize: 11, color: COLORS.muted, marginLeft: 8 },
  roomPreview: { fontSize: 13, color: COLORS.muted },
  roomPreviewUnread: { color: COLORS.ink, fontWeight: '500' },
  roomPreviewEmpty: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic' },
  unreadBadge: {
    backgroundColor: COLORS.forest,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },

  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 72 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptyText:  { fontSize: 14, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 32 },

  // Thread header
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.forest,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backBtn:   { width: 56 },
  backText:  { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  threadTitle: { flex: 1, textAlign: 'center', color: COLORS.white, fontWeight: '700', fontSize: 16 },

  // Bubbles
  bubbleWrap: {
    paddingHorizontal: 16,
    marginVertical: 4,
    alignItems: 'flex-start',
  },
  bubbleWrapMe: { alignItems: 'flex-end' },
  bubbleSender: { fontSize: 11, color: COLORS.forest, fontWeight: '600', marginBottom: 3, marginLeft: 2 },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleThem: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4 },
  bubbleMe:   { backgroundColor: COLORS.forest, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, color: COLORS.ink, lineHeight: 21 },
  bubbleTextMe: { color: COLORS.white },
  bubbleTime: { fontSize: 10, color: COLORS.muted, marginTop: 3, marginLeft: 4 },
  bubbleTimeMe: { marginLeft: 0, marginRight: 4 },
  deletedText: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic', paddingHorizontal: 4 },

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
  sendBtnText: { color: COLORS.white, fontSize: 20, fontWeight: '700' },
});
