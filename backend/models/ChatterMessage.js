const { DataTypes } = require('sequelize');

/**
 * ChatterMessage — polymorphic activity thread attached to any ERP record.
 *
 * Modelled after Odoo's mail.message pattern.
 * entityType + entityId identify the parent record (e.g. 'Quotation', 'QT-0001').
 * messageType separates user comments from automated system events so the UI
 * can render them differently.
 */
module.exports = (sequelize) => {
  const ChatterMessage = sequelize.define('ChatterMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Polymorphic parent ─────────────────────────────────────────────────
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Model name of the parent record, e.g. Quotation, Lead, SalesOrder',
    },
    entityId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'PK of the parent record (stored as string to support UUID and int PKs)',
    },

    // ── Message classification ─────────────────────────────────────────────
    messageType: {
      type: DataTypes.ENUM(
        'comment',          // user-posted message / note
        'event',            // automated system event (e.g. record created)
        'status_change',    // status transitioned (old → new captured in metadata)
        'approval_request', // manager approval requested
        'approval_decision',// manager approved / rejected
        'activity',         // scheduled activity logged
        'email_sent',       // outbound email recorded
        'file_attachment',  // file uploaded to the record
      ),
      allowNull: false,
      defaultValue: 'comment',
    },

    // ── Content ────────────────────────────────────────────────────────────
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Message body (plain text or simple Markdown)',
    },

    // ── Author ─────────────────────────────────────────────────────────────
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Null for fully automated system events with no user context',
    },
    authorName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Denormalised snapshot so old messages still show the right name',
    },

    // ── Structured data for event-type messages ────────────────────────────
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'e.g. { oldStatus: "draft", newStatus: "sent" } for status_change',
    },

    // ── File attachments ───────────────────────────────────────────────────
    attachments: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of { name, url, mimeType, sizeBytes }',
    },

    // ── Threading (future: threaded replies) ──────────────────────────────
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'For reply threads — points to the parent ChatterMessage',
    },

  }, {
    tableName: 'ChatterMessages',
    timestamps: true,
    indexes: [
      // Fast lookup: all messages on a given record
      { fields: ['entityType', 'entityId'] },
      // All messages by a given user
      { fields: ['userId'] },
    ],
  });

  ChatterMessage.associate = (models) => {
    ChatterMessage.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'author',
    });
    ChatterMessage.belongsTo(models.ChatterMessage, {
      foreignKey: 'parentId',
      as: 'parent',
    });
    ChatterMessage.hasMany(models.Chatt