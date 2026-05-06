/**
 * Chat Controller
 * REST API for the internal chat + omnichannel inbox system.
 *
 * Rooms:
 *   GET    /api/chat/rooms                    — my rooms (with unread counts)
 *   POST   /api/chat/rooms                    — create channel
 *   POST   /api/chat/rooms/dm                 — get-or-create DM with a user
 *   GET    /api/chat/rooms/:id                — room detail + members
 *   PATCH  /api/chat/rooms/:id                — update name/description/archive
 *   DELETE /api/chat/rooms/:id                — hard delete (admin only, empty rooms)
 *
 * Members:
 *   GET    /api/chat/rooms/:id/members        — list members
 *   POST   /api/chat/rooms/:id/members        — add member(s)
 *   DELETE /api/chat/rooms/:id/members/:uid   — remove member
 *
 * Messages:
 *   GET    /api/chat/rooms/:id/messages       — paginated history
 *   POST   /api/chat/rooms/:id/messages       — send message
 *   PATCH  /api/chat/rooms/:id/messages/:mid  — edit message
 *   DELETE /api/chat/rooms/:id/messages/:mid  — soft delete
 *   POST   /api/chat/rooms/:id/messages/:mid/react — toggle reaction
 *
 * Read receipts:
 *   POST   /api/chat/rooms/:id/read           — mark all read (update lastReadAt)
 *
 * Utility:
 *   GET    /api/chat/users                    — all users for @mention / DM initiation
 */

const { ChatRoom, ChatMessage, ChatRoomMember, User } = require('../models');
const { getSuccessResponse } = require('../utils/helpers');
const chatService = require('../services/chatService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const userAttrs = ['id', 'firstName', 'lastName', 'email', 'role'];

// ── Shared include for message with sender ────────────────────────────────────
const messageInclude = [
  { model: User, as: 'sender', attributes: userAttrs },
];

// ── Verify membership (throws if not a member or left) ───────────────────────
async function assertMember(roomId, userId) {
  const membership = await ChatRoomMember.findOne({
    where: { roomId, userId, leftAt: null },
  });
  if (!membership) {
    const err = new Error('You are not a member of this chat room.');
    err.status = 403;
    throw err;
  }
  return membership;
}

// ── Verify room admin (throws if not admin or room creator) ──────────────────
async function assertRoomAdmin(roomId, userId, room) {
  const membership = await ChatRoomMember.findOne({
    where: { roomId, userId, leftAt: null },
  });
  const isAdmin = membership && membership.role === 'admin';
  const isCreator = room.createdById === userId;
  const isGlobalAdmin = false; // handled by caller via req.user.role check
  if (!isAdmin && !isCreator) {
    const err = new Error('Only room admins may perform this action.');
    err.status = 403;
    throw err;
  }
  return membership;
}

// ── Unread count helper ───────────────────────────────────────────────────────
async function getUnreadCount(roomId, lastReadAt) {
  if (!lastReadAt) {
    return await ChatMessage.count({ where: { roomId, deletedAt: null } });
  }
  return await ChatMessage.count({
    where: { roomId, createdAt: { [Op.gt]: lastReadAt }, deletedAt: null },
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ROOMS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/rooms
 * List all rooms the current user is an active member of, with unread counts.
 */
exports.listRooms = async (req, res, next) => {
  try {
    const memberships = await ChatRoomMember.findAll({
      where: { userId: req.user.id, leftAt: null },
      include: [
        {
          model: ChatRoom,
          as: 'room',
          where: { isArchived: false },
          include: [
            { model: User, as: 'createdBy', attributes: userAttrs },
          ],
        },
      ],
      order: [[{ model: ChatRoom, as: 'room' }, 'lastMessageAt', 'DESC NULLS LAST']],
    });

    // Attach unread counts
    const rooms = await Promise.all(
      memberships.map(async (m) => {
        const unread = await getUnreadCount(m.roomId, m.lastReadAt);
        return {
          ...m.room.toJSON(),
          membership: {
            role: m.role,
            lastReadAt: m.lastReadAt,
            mutedUntil: m.mutedUntil,
            notifyOnMentionOnly: m.notifyOnMentionOnly,
          },
          unreadCount: unread,
        };
      })
    );

    res.json(getSuccessResponse(rooms));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chat/rooms
 * Create a named channel (type='channel').
 * Body: { name, description?, isPrivate? }
 */
exports.createRoom = async (req, res, next) => {
  try {
    const { name, description, isPrivate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'name is required.' });
    }

    const room = await ChatRoom.create({
      type: 'channel',
      name: name.trim(),
      description: description || null,
      isPrivate: !!isPrivate,
      createdById: req.user.id,
      channelSource: 'internal',
    });

    // Add creator as admin member
    await ChatRoomMember.create({
      roomId: room.id,
      userId: req.user.id,
      role: 'admin',
      joinedAt: new Date(),
    });

    const created = await ChatRoom.findByPk(room.id, {
      include: [{ model: User, as: 'createdBy', attributes: userAttrs }],
    });

    res.status(201).json(getSuccessResponse(created, 'Room created.'));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chat/rooms/dm
 * Get-or-create a direct message room between the current user and another.
 * Body: { userId }
 */
exports.getOrCreateDM = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot DM yourself.' });
    }

    const otherUser = await User.findByPk(userId, { attributes: userAttrs });
    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Canonical DM: dmUserA < dmUserB (alphabetical by UUID)
    const [uA, uB] = [req.user.id, userId].sort();

    let room = await ChatRoom.findOne({
      where: { type: 'dm', dmUserA: uA, dmUserB: uB },
    });

    if (!room) {
      room = await ChatRoom.create({
        type: 'dm',
        dmUserA: uA,
        dmUserB: uB,
        createdById: req.user.id,
        channelSource: 'internal',
      });

      await ChatRoomMember.bulkCreate([
        { roomId: room.id, userId: req.user.id, role: 'member', joinedAt: new Date() },
        { roomId: room.id, userId, role: 'member', joinedAt: new Date() },
      ]);

      // Notify the other user
      chatService.notifyUserAddedToRoom(userId, room);
    }

    // Attach the other user's info for display
    const result = {
      ...room.toJSON(),
      otherUser,
    };

    res.json(getSuccessResponse(result));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/chat/rooms/:id
 * Room detail with member list.
 */
exports.getRoom = async (req, res, next) => {
  try {
    await assertMember(req.params.id, req.user.id);

    const room = await ChatRoom.findByPk(req.params.id, {
      include: [
        { model: User, as: 'createdBy', attributes: userAttrs },
        {
          model: ChatRoomMember,
          as: 'members',
          where: { leftAt: null },
          required: false,
          include: [
            { model: User, as: 'user', attributes: userAttrs },
          ],
        },
      ],
    });

    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    res.json(getSuccessResponse(room));
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/chat/rooms/:id
 * Update room name/description/archive status.
 * Body: { name?, description?, isArchived?, isPrivate? }
 */
exports.updateRoom = async (req, res, next) => {
  try {
    const room = await ChatRoom.findByPk(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const isGlobalAdmin = ['admin', 'manager'].includes(req.user.role);
    if (!isGlobalAdmin) {
      await assertRoomAdmin(room.id, req.user.id, room);
    }

    const { name, description, isArchived, isPrivate } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (isArchived !== undefined) updates.isArchived = isArchived;
    if (isPrivate !== undefined) updates.isPrivate = isPrivate;

    await room.update(updates);

    chatService.emitRoomUpdated(room.id, room);

    res.json(getSuccessResponse(room, 'Room updated.'));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/chat/rooms/:id
 * Hard delete — only empty rooms, admin only.
 */
exports.deleteRoom = async (req, res, next) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }

    const room = await ChatRoom.findByPk(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const msgCount = await ChatMessage.count({ where: { roomId: room.id } });
    if (msgCount > 0) {
      return res.status(422).json({
        success: false,
        message: 'Cannot delete a room that contains messages. Archive it instead.',
      });
    }

    await room.destroy();
    res.json(getSuccessResponse({ id: req.params.id }, 'Room deleted.'));
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// MEMBERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/rooms/:id/members
 */
exports.listMembers = async (req, res, next) => {
  try {
    await assertMember(req.params.id, req.user.id);

    const members = await ChatRoomMember.findAll({
      where: { roomId: req.params.id, leftAt: null },
      include: [{ model: User, as: 'user', attributes: userAttrs }],
      order: [['joinedAt', 'ASC']],
    });

    res.json(getSuccessResponse(members));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chat/rooms/:id/members
 * Add one or more members.
 * Body: { userIds: string[] }
 */
exports.addMembers = async (req, res, next) => {
  try {
    const room = await ChatRoom.findByPk(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const isGlobalAdmin = ['admin', 'manager'].includes(req.user.role);
    if (!isGlobalAdmin) {
      await assertRoomAdmin(room.id, req.user.id, room);
    }

    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'userIds array is required.' });
    }

    const added = [];
    for (const uid of userIds) {
      const existing = await ChatRoomMember.findOne({ where: { roomId: room.id, userId: uid } });
      if (existing) {
        if (existing.leftAt) {
          // Re-add
          await existing.update({ leftAt: null, joinedAt: new Date(), invitedById: req.user.id });
          added.push(existing);
        }
        // Already active — skip silently
        continue;
      }
      const member = await ChatRoomMember.create({
        roomId: room.id,
        userId: uid,
        role: 'member',
        joinedAt: new Date(),
        invitedById: req.user.id,
      });
      added.push(member);

      const user = await User.findByPk(uid, { attributes: userAttrs });
      chatService.emitMemberAdded(room.id, { ...member.toJSON(), user });
      chatService.notifyUserAddedToRoom(uid, room);
    }

    res.json(getSuccessResponse(added, `${added.length} member(s) added.`));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/chat/rooms/:id/members/:uid
 * Remove a member (soft — sets leftAt).
 */
exports.removeMember = async (req, res, next) => {
  try {
    const room = await ChatRoom.findByPk(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const isSelf = req.params.uid === req.user.id;
    const isGlobalAdmin = ['admin', 'manager'].includes(req.user.role);
    if (!isSelf && !isGlobalAdmin) {
      await assertRoomAdmin(room.id, req.user.id, room);
    }

    const member = await ChatRoomMember.findOne({
      where: { roomId: room.id, userId: req.params.uid, leftAt: null },
    });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    await member.update({ leftAt: new Date() });
    chatService.emitMemberRemoved(room.id, req.params.uid);

    res.json(getSuccessResponse({ userId: req.params.uid }, 'Member removed.'));
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/rooms/:id/messages
 * Paginated message history, newest-first (cursor-based via `before` timestamp).
 * Query: { limit=50, before? (ISO timestamp) }
 */
exports.listMessages = async (req, res, next) => {
  try {
    await assertMember(req.params.id, req.user.id);

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const where = { roomId: req.params.id };
    if (req.query.before) {
      where.createdAt = { [Op.lt]: new Date(req.query.before) };
    }

    const messages = await ChatMessage.findAll({
      where,
      include: messageInclude,
      order: [['createdAt', 'DESC']],
      limit,
    });

    // Return in ascending order for display
    res.json(getSuccessResponse(messages.reverse()));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chat/rooms/:id/messages
 * Send a message.
 * Body: { body, mentions?, entityRef?, attachments?, parentId? }
 */
exports.sendMessage = async (req, res, next) => {
  try {
    await assertMember(req.params.id, req.user.id);

    const { body, mentions, entityRef, attachments, parentId } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'body is required.' });
    }

    const message = await ChatMessage.create({
      roomId: req.params.id,
      senderId: req.user.id,
      body: body.trim(),
      mentions: mentions || [],
      entityRef: entityRef || null,
      attachments: attachments || [],
      parentId: parentId || null,
      source: 'internal',
    });

    // Update room's last activity snapshot
    await ChatRoom.update(
      {
        lastMessageAt: message.createdAt,
        lastMessagePreview: body.substring(0, 200),
      },
      { where: { id: req.params.id } }
    );

    const full = await ChatMessage.findByPk(message.id, { include: messageInclude });

    // Emit to all room subscribers
    chatService.emitNewMessage(req.params.id, full);

    res.status(201).json(getSuccessResponse(full, 'Message sent.'));
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/chat/rooms/:id/messages/:mid
 * Edit own message.
 * Body: { body }
 */
exports.editMessage = async (req, res, next) => {
  try {
    const msg = await ChatMessage.findOne({
      where: { id: req.params.mid, roomId: req.params.id },
    });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found.' });
    if (msg.senderId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages.' });
    }
    if (msg.deletedAt) {
      return res.status(422).json({ success: false, message: 'Cannot edit a deleted message.' });
    }

    const { body } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'body is required.' });
    }

    await msg.update({ body: body.trim(), editedAt: new Date() });
    const full = await ChatMessage.findByPk(msg.id, { include: messageInclude });

    chatService.emitMessageEdited(req.params.id, full);

    res.json(getSuccessResponse(full, 'Message updated.'));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/chat/rooms/:id/messages/:mid
 * Soft delete (body cleared, deletedAt set).
 * Sender or room admin / global admin may delete.
 */
exports.deleteMessage = async (req, res, next) => {
  try {
    const msg = await ChatMessage.findOne({
      where: { id: req.params.mid, roomId: req.params.id },
    });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found.' });

    const isSender = msg.senderId === req.user.id;
    const isGlobalAdmin = ['admin', 'manager'].includes(req.user.role);

    let isRoomAdmin = false;
    if (!isSender && !isGlobalAdmin) {
      const m = await ChatRoomMember.findOne({
        where: { roomId: req.params.id, userId: req.user.id, leftAt: null },
      });
      isRoomAdmin = m && m.role === 'admin';
    }

    if (!isSender && !isGlobalAdmin && !isRoomAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this message.' });
    }

    if (msg.deletedAt) {
      return res.status(422).json({ success: false, message: 'Message already deleted.' });
    }

    await msg.update({ body: null, deletedAt: new Date() });

    chatService.emitMessageDeleted(req.params.id, msg.id);

    res.json(getSuccessResponse({ id: msg.id }, 'Message deleted.'));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chat/rooms/:id/messages/:mid/react
 * Toggle a reaction emoji.
 * Body: { emoji }
 */
exports.toggleReaction = async (req, res, next) => {
  try {
    await assertMember(req.params.id, req.user.id);

    const msg = await ChatMessage.findOne({
      where: { id: req.params.mid, roomId: req.params.id },
    });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found.' });

    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'emoji is required.' });

    const reactions = { ...(msg.reactions || {}) };
    const users = reactions[emoji] || [];
    const idx = users.indexOf(req.user.id);

    if (idx === -1) {
      reactions[emoji] = [...users, req.user.id];
    } else {
      const updated = [...users];
      updated.splice(idx, 1);
      if (updated.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = updated;
      }
    }

    await msg.update({ reactions });
    const full = await ChatMessage.findByPk(msg.id, { include: messageInclude });

    chatService.emitMessageEdited(req.params.id, full);

    res.json(getSuccessResponse(full));
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// READ RECEIPTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/chat/rooms/:id/read
 * Mark all messages in this room as read (set lastReadAt = now).
 */
exports.markRead = async (req, res, next) => {
  try {
    const membership = await assertMember(req.params.id, req.user.id);
    const now = new Date();
    await membership.update({ lastReadAt: now });

    chatService.emitReadReceipt(req.params.id, req.user.id, now);

    res.json(getSuccessResponse({ lastReadAt: now }));
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// UTILITY
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/users
 * All active users for @mention autocomplete and DM initiation.
 * Optionally filter by ?q=search
 */
exports.listUsers = async (req, res, next) => {
  try {
    const where = { isActive: true };
    if (req.query.q) {
      const q = `%${req.query.q}%`;
      where[Op.or] = [
        { firstName: { [Op.like]: q } },
        { lastName: { [Op.like]: q } },
        { email: { [Op.like]: q } },
      ];
    }

    const users = await User.findAll({
      where,
      attributes: userAttrs,
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
      limit: 50,
    });

    res.json(getSuccessResponse(users));
  } catch (err) {
    next(err);
  }
};
