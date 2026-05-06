const { DataTypes } = require('sequelize');

/**
 * ChatMessage — a single message in a ChatRoom.
 *
 * Supports:
 *  - Internal messages from ERP users
 *  - Inbound messages from external channels (WhatsApp, Telegram, etc.)
 *  - @mention tracking for notification routing
 *  - ERP record linking (e.g. "QT-0042") stored in entityRef
 *  - Soft deletion (body replaced with null, deletedAt set)
 *  - Reply threading via parentId
 *  - Read receipts via ChatRoomMember.lastReadAt (cursor-based, not per-message)
 */
module.exports = (sequelize) => {
  const ChatMessage = sequelize.define('ChatMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Room ──────────────────────────────────────────────────────────────────
    roomId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // ── Author — internal user (null for inbound external messages) ───────────
    senderId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ERP User id. Null if the message originated externally (WhatsApp, Telegram, etc.)',
    },

    // ── Content ───────────────────────────────────────────────────────────────
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Message text. Null when message has been deleted (soft delete).',
    },
    attachments: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of { name, url, mimeType, sizeBytes }',
    },

    // ── Omnichannel — external origin ─────────────────────────────────────────
    source: {
      type: DataTypes.ENUM('internal', 'whatsapp', 'telegram', 'wechat', 'email', 'sms'),
      defaultValue: 'internal',
      allowNull: false,
      comment: 'Channel this message came from. internal = sent by an ERP user. wechat = WeChat Work / WeCom webhook.',
    },
    externalId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Platform message ID (e.g. WA message ID, Telegram message_id). Used for dedup on webhook replay.',
    },
    externalSenderId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'External sender identifier (phone number, Telegram user_id, etc.)',
    },
    externalSenderName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Display name of the external sender at time of delivery',
    },

    // ── @mentions ─────────────────────────────────────────────────────────────
    mentions: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of User UUIDs mentioned with @ in the message body. Used to trigger notifications.',
    },

    // ── ERP record link ───────────────────────────────────────────────────────
    entityRef: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Linked ERP record, e.g. { type: "Quotation", id: "QT-0042", label: "Quote for Acme — $12,000" }',
    },

    // ── Threading ─────────────────────────────────────────────────────────────
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reply parent message id for threaded conversations',
    },

    // ── Edit / delete lifecycle ────────────────────────────────────────────────
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Set when the sender edits the message body',
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Soft delete timestamp. UI shows "Message deleted." when set.',
    },

    // ── Reactions (future — stored as JSON for v1 simplicity) ─────────────────
    reactions: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Map of emoji → [userId, ...]. e.g. { "👍": ["uuid-1", "uuid-2"] }',
    },

  }, {
    tableName: 'ChatMessages',
    timestamps: true,
    indexes: [
      // Primary read pattern: all messages in a room, paginated
      { fields: ['room_id', 'created_at'] },
      // All messages by a sender
      { fields: ['sender_id'] },
      // External dedup: prevent duplicate ingest on webhook replay.
      // SQLite allows multiple NULLs in a unique index (NULL != NULL), so
      // internal messages with null externalId don't collide.
      { unique: true, fields: ['source', 'external_id'] },
      // Reply thread lookup
      { fields: ['parent_id'] },
    ],
  });

  ChatMessage.associate = (models) => {
    ChatMessage.belongsTo(models.ChatRoom, {
      foreignKey: 'roomId',
      as: 'room',
    });
    ChatMessage.belongsTo(models.User, {
      foreignKey: 'senderId',
      as: 'sender',
    });
    ChatMessage.belongsTo(models.ChatMessage, {
      foreignKey: 'parentId',
      as: 'parent',
    });
    ChatMessage.hasMany(models.ChatMessage, {
      foreignKey: 'parentId',
      as: 'replies',
    });
  };

  return ChatMessage;
};
