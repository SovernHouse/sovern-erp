const { DataTypes } = require('sequelize');

/**
 * ChatRoomMember — join table tracking who is in which ChatRoom.
 *
 * Read receipts are cursor-based: lastReadAt marks the timestamp up to which
 * the user has read. Unread count = ChatMessages where createdAt > lastReadAt.
 * This is O(1) to update and avoids a per-message-per-user read-receipt row.
 *
 * role 'admin'  : can rename/archive the room, add/remove members
 * role 'member' : can read and send messages only
 */
module.exports = (sequelize) => {
  const ChatRoomMember = sequelize.define('ChatRoomMember', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Relations ─────────────────────────────────────────────────────────────
    roomId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // ── Role ──────────────────────────────────────────────────────────────────
    role: {
      type: DataTypes.ENUM('admin', 'member'),
      defaultValue: 'member',
      allowNull: false,
    },

    // ── Read receipt (cursor-based) ────────────────────────────────────────────
    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of the last message this user has read. Unread = messages after this.',
    },

    // ── Membership lifecycle ───────────────────────────────────────────────────
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    leftAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Set when the user leaves or is removed. Soft membership — history preserved.',
    },
    invitedById: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'User who added this member to the room',
    },

    // ── Notification preferences per room ─────────────────────────────────────
    mutedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'If set and in the future, suppress push notifications for this room until this time',
    },
    notifyOnMentionOnly: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'When true, only notify on @mentions in this room — not every message',
    },

  }, {
    tableName: 'ChatRoomMembers',
    timestamps: true,
    indexes: [
      // Unique membership: one row per user per room
      { unique: true, fields: ['room_id', 'user_id'] },
      // All rooms a user is in
      { fields: ['user_id'] },
      // All members of a room
      { fields: ['room_id'] },
    ],
  });

  ChatRoomMember.associate = (models) => {
    ChatRoomMember.belongsTo(models.ChatRoom, {
      foreignKey: 'roomId',
      as: 'room',
    });
    ChatRoomMember.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    ChatRoomMember.belongsTo(models.User, {
      foreignKey: 'invitedById',
      as: 'invitedBy',
    });
  };

  return ChatRoomMember;
};
