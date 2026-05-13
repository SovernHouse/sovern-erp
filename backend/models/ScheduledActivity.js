const { DataTypes } = require('sequelize');

/**
 * ScheduledActivity — Odoo-style mail.activity equivalent.
 *
 * A task assigned to a user, attached to any ERP record (polymorphic via
 * entityType + entityId), with a due date and colour-coded urgency.
 *
 * Lifecycle:
 *   pending → done      (user marks it complete)
 *   pending → cancelled (creator or admin cancels)
 *
 * When created or completed, a ChatterMessage of type 'activity' is posted
 * on the linked record so the activity appears in the record's chatter thread.
 */
module.exports = (sequelize) => {
  const ScheduledActivity = sequelize.define('ScheduledActivity', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Activity type ──────────────────────────────────────────────────────
    type: {
      type: DataTypes.ENUM(
        'follow_up',
        'check_document',
        'approve',
        'send',
        'call',
        'meeting',
        'other'
      ),
      allowNull: false,
      defaultValue: 'follow_up',
    },

    // ── Polymorphic parent record ──────────────────────────────────────────
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Model name, e.g. Quotation, Lead, SalesOrder',
    },
    entityId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'PK of the parent record (stored as string to support UUID and int PKs)',
    },
    entityLabel: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Denormalised display label, e.g. "QT-0042 — ABC Co." — avoids joins in banner',
    },

    // ── Assignment ────────────────────────────────────────────────────────
    assignedToId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User who must perform the action',
    },
    assignedById: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'User who created the task (null for system-generated tasks)',
    },

    // ── Scheduling ────────────────────────────────────────────────────────
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Absolute due date. Colour: green = future, yellow = today, red = past',
    },

    // ── Content ───────────────────────────────────────────────────────────
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Instructions or context for the assignee',
    },

    // ── Priority ──────────────────────────────────────────────────────────
    priority: {
      type: DataTypes.ENUM('normal', 'urgent'),
      defaultValue: 'normal',
    },

    // ── Status ────────────────────────────────────────────────────────────
    status: {
      type: DataTypes.ENUM('pending', 'done', 'cancelled'),
      defaultValue: 'pending',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional feedback when marking done',
    },
    // Multi-brand (Phase 1, D-1). FK to Brand.code in models/index.js.
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'SH',
    },

  }, {
    tableName: 'ScheduledActivities',
    timestamps: true,
    indexes: [
      // Fast lookup: all pending activities for a user (dashboard banner)
      { fields: ['assigned_to_id', 'status'] },
      // All activities on a given record (chatter integration)
      { fields: ['entity_type', 'entity_id'] },
      // Due date ordering
      { fields: ['due_date', 'status'] },
    ],
  });

  ScheduledActivity.associate = (models) => {
    ScheduledActivity.belongsTo(models.User, {
      foreignKey: 'assignedToId',
      as: 'assignedTo',
    });
    ScheduledActivity.belongsTo(models.User, {
      foreignKey: 'assignedById',
      as: 'assignedBy',
    });
  };

  return ScheduledActivity;
};
