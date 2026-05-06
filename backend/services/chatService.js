/**
 * chatService — socket.io bridge for the internal chat system.
 *
 * Pattern mirrors notificationService: server.js calls setIO(io) after
 * socket.io is initialized, then the controller calls emit helpers here.
 *
 * Socket rooms follow the convention: `chat-room-${chatRoomId}`
 * Each connected user automatically joins their personal `user-${userId}` room
 * (established by socketAuthMiddleware) so we can notify them of DM / mention
 * events even if they haven't opened that chat room.
 */

let _io = null;

/**
 * Called once from server.js after socket.io is initialized.
 * @param {import('socket.io').Server} io
 */
const setIO = (io) => {
  _io = io;
};

const getIO = () => _io;

// ── Room socket name helper ───────────────────────────────────────────────────
const roomKey = (chatRoomId) => `chat-room-${chatRoomId}`;

// ── Emit helpers ──────────────────────────────────────────────────────────────

/**
 * Broadcast a new message to everyone in the chat room.
 * @param {string} chatRoomId
 * @param {object} message  Serialized ChatMessage (with sender included)
 */
const emitNewMessage = (chatRoomId, message) => {
  if (!_io) return;
  _io.to(roomKey(chatRoomId)).emit('chat:new_message', { roomId: chatRoomId, message });
};

/**
 * Broadcast an edited message.
 */
const emitMessageEdited = (chatRoomId, message) => {
  if (!_io) return;
  _io.to(roomKey(chatRoomId)).emit('chat:message_edited', { roomId: chatRoomId, message });
};

/**
 * Broadcast a soft-deleted message (body hidden, deletedAt set).
 */
const emitMessageDeleted = (chatRoomId, messageId) => {
  if (!_io) return;
  _io.to(roomKey(chatRoomId)).emit('chat:message_deleted', { roomId: chatRoomId, messageId });
};

/**
 * Notify all room members that a new member joined.
 */
const emitMemberAdded = (chatRoomId, member) => {
  if (!_io) return;
  _io.to(roomKey(chatRoomId)).emit('chat:member_added', { roomId: chatRoomId, member });
};

/**
 * Notify room that a member was removed.
 */
const emitMemberRemoved = (chatRoomId, userId) => {
  if (!_io) return;
  _io.to(roomKey(chatRoomId)).emit('chat:member_removed', { roomId: chatRoomId, userId });
};

/**
 * Notify room of a room update (rename, archive, etc.)
 */
const emitRoomUpdated = (chatRoomId, room) => {
  if (!_io) return;
  _io.to(roomKey(chatRoomId)).emit('chat:room_updated', { roomId: chatRoomId, room });
};

/**
 * Notify a specific user (by userId) that they were added to a new room.
 * Used to push the room into the sidebar of a user who isn't currently
 * subscribed to that room's socket room.
 */
const notifyUserAddedToRoom = (userId, room) => {
  if (!_io) return;
  _io.to(`user-${userId}`).emit('chat:added_to_room', { room });
};

/**
 * Broadcast a typing indicator. Clients throttle sends; server just relays.
 * @param {string} chatRoomId
 * @param {object} typingPayload  { userId, userName, isTyping }
 */
const emitTyping = (chatRoomId, typingPayload) => {
  if (!_io) return;
  _io.to(roomKey(chatRoomId)).emit('chat:typing', { roomId: chatRoomId, ...typingPayload });
};

/**
 * Notify room that someone marked messages as read up to a timestamp.
 */
const emitReadReceipt = (chatRoomId, userId, lastReadAt) => {
  if (!_io) return;
  _io.to(roomKey(chatRoomId)).emit('chat:read', { roomId: chatRoomId, userId, lastReadAt });
};

/**
 * Attach chat socket event handlers to the io instance.
 * Call this from server.js inside io.on('connection', ...).
 * @param {import('socket.io').Socket} socket
 */
const handleChatSocket = (socket) => {
  // Client joins a chat room to receive its events
  socket.on('chat:join_room', (chatRoomId) => {
    if (chatRoomId) {
      socket.join(roomKey(chatRoomId));
    }
  });

  // Client leaves a chat room (e.g. navigating away)
  socket.on('chat:leave_room', (chatRoomId) => {
    if (chatRoomId) {
      socket.leave(roomKey(chatRoomId));
    }
  });

  // Typing indicator relay — client → room (excluding sender)
  socket.on('chat:typing', ({ chatRoomId, isTyping }) => {
    if (!chatRoomId) return;
    socket.to(roomKey(chatRoomId)).emit('chat:typing', {
      roomId: chatRoomId,
      userId: socket.userId,
      isTyping: !!isTyping,
    });
  });
};

module.exports = {
  setIO,
  getIO,
  roomKey,
  emitNewMessage,
  emitMessageEdited,
  emitMessageDeleted,
  emitMemberAdded,
  emitMemberRemoved,
  emitRoomUpdated,
  notifyUserAddedToRoom,
  emitTyping,
  emitReadReceipt,
  handleChatSocket,
};
