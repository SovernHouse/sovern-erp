/**
 * AIConversation model
 * Stores per-user chat sessions with the in-ERP Claude assistant.
 * Messages are stored as a JSON array in a TEXT column (SQLite-friendly).
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AIConversation = sequelize.define('AIConversation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      defaultValue: 'New conversation',
    },
    // JSON array of { role: 'user'|'assistant', content: string, createdAt: ISO }
    messages: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      get() {
        const raw = this.getDataValue('messages');
        try { return raw ? JSON.parse(raw) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('messages', Array.isArray(val) ? JSON.stringify(val) : val);
      },
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'AIConversations',
    underscored: true,
    timestamps: true,
  });

  return AIConversation;
};
