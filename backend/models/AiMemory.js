/**
 * AiMemory — Phase 4.18e.
 *
 * Per-user durable facts, preferences, voice rules, and corrections
 * that survive across AI chat sessions. The MCP tools `remember_fact`,
 * `forget_fact`, and `list_memories` are the only writers; the
 * aiContextService injects the top N most-recent active rows into
 * every system prompt build.
 *
 * Soft-delete via `isActive=false` — forget_fact never hard-deletes
 * so the audit trail stays intact.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AiMemory = sequelize.define('AiMemory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'User', key: 'id' },
    },
    kind: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'fact',
      // free-form for forward-compat, but typical values:
      // preference | fact | correction | voice_rule
    },
    key: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING(64),
      allowNull: true,
      // explicit-remember-command | auto-detected-correction | seed
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastReferencedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'AiMemory',
    indexes: [
      // Column names are snake_case in this codebase via the global
      // Sequelize define option (config/database.js underscored:true).
      { fields: ['user_id', 'is_active'] },
      { fields: ['user_id', 'key'], unique: false },
    ],
  });

  AiMemory.associate = (db) => {
    if (db.User) {
      AiMemory.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
    }
  };

  return AiMemory;
};
