const { DataTypes } = require('sequelize');

/**
 * ChatRoom — a conversation container.
 *
 * type 'dm'      : direct message between two internal users
 * type 'channel' : named group channel (open or members-only)
 * type 'external': ingested from an external channel (WhatsApp, Telegram, etc.)
 *
 * channelSource tracks origin for omnichannel: 'internal' | 'whatsapp' | 'telegram' | 'email' | 'sms'
 * externalRoomId stores the external platform's room/group/thread identifier for dedup and reply routing.
 */
module.exports = (sequelize) => {
  const ChatRoom = sequelize.define('ChatRoom', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Room type ─────────────────────────────────────────────────────────────
    type: {
      type: DataTypes.ENUM('dm', 'channel', 'external'),
      allowNull: false,
      defaultValue: 'channel',
    },

    // ── Display ───────────────────────────────────────────────────────────────
    name: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: 'Required for channels; auto-generated for DMs; may be the contact name for external rooms',
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Optional room icon / avatar image URL',
    },

    // ── Creator ───────────────────────────────────────────────────────────────
    createdById: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'User who created the room; null for system-created or inbound external rooms',
    },

    // ── State ─────────────────────────────────────────────────────────────────
    isArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isPrivate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Private channels require explicit invitation; public channels are discoverable',
    },

    // ── Omnichannel — external source tracking ────────────────────────────────
    channelSource: {
      type: DataTypes.ENUM('internal', 'whatsapp', 'telegram', 'wechat', 'email', 'sms'),
      defaultValue: 'internal',
      allowNull: false,
      comment: 'Origin channel. internal = native ERP chat. wechat = WeChat Work / WeCom webhook. Others = ingested from external platform.',
    },
    externalRoomId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Platform-specific group/thread ID (e.g. WA group JID, Telegram chat_id). Used for dedup and reply routing.',
    },
    externalRoomMeta: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Arbitrary metadata from the external platform (e.g. WA group subject, TG title, phone numbers)',
    },

    // ── DM convenience — two-user shortcut ───────────────────────────────────
    // For DMs we store both user IDs here so we can look up an existing DM
    // without scanning ChatRoomMembers. Both are nullable (only set for type='dm').
    dmUserA: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    dmUserB: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // ── Pinned message ────────────────────────────────────────────────────────
    pinnedMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Optionally pinned ChatMessage for quick reference',
    },

    // ── Last activity snapshot (denormalised for sidebar sorting) ─────────────
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastMessagePreview: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

  }, {
    tableName: 'ChatRooms',
    timestamps: true,
    indexes: [
      { fields: ['type'] },
      { fields: ['channel_source'] },
      // Fast DM lookup — find the room for a given pair
      { fields: ['dm_user_a', 'dm_user_b'] },
      // External room dedup
      { fields: ['channel_source', 'external_room_id'] },
    ],
  });

  ChatRoom.associate = (models) => {
    ChatRoom.belongsTo(models.User, {
      foreignKey: 'createdById',
      as: 'createdBy',
    });
    ChatRoom.hasMany(models.ChatMessage, {
      foreignKey: 'roomId',
      as: 'messages',
      onDelete: 'CASCADE',
    });
    ChatRoom.hasMany(models.ChatRoomMember, {
      foreignKey: 'roomId',
      as: 'members',
      onDelete: 'CASCADE',
    });
  };

  return ChatRoom;
};
