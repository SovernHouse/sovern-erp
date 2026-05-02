/**
 * InternalApproval — manager sign-off on staff work.
 *
 * DISTINCT from DocumentApproval (client-facing, token-based e-signature).
 * This model covers internal review workflows:
 *   - Staff submits a quotation/SO/PO for manager review before it goes out
 *   - Manager approves or rejects with a comment
 *   - Each rejection creates a new approval request (version bump)
 *
 * entityType + entityId identify the record being approved (polymorphic, same
 * pattern as ChatterMessage).
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InternalApproval = sequelize.define('InternalApproval', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── What is being approved ─────────────────────────────────────────────
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'E.g. Quotation, SalesOrder, PurchaseOrder, Lead (stage advancement)',
    },
    entityId: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // ── Approval type (drives different review checklists in the UI) ────────
    approvalType: {
      type: DataTypes.ENUM(
        'send_quotation',     // approve before emailing quotation to client
        'confirm_sales_order',// approve before confirming an SO
        'place_purchase_order',// approve before placing a PO with supplier
        'process_payment',    // approve before releasing a payment
        'stage_advancement',  // approve a lead/deal moving to the next stage
        'general',            // catch-all for any other review
      ),
      allowNull: false,
      defaultValue: 'general',
    },

    // ── People ─────────────────────────────────────────────────────────────
    requestedByUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    assignedToUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'If null, any manager/admin can approve',
    },
    decidedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // ── Workflow state ─────────────────────────────────────────────────────
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },

    // ── Context ────────────────────────────────────────────────────────────
    requestNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional note from the requester explaining context',
    },
    decisionNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Manager comment on approve / reject',
    },
    decidedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // ── Urgency ────────────────────────────────────────────────────────────
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal',
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },

  }, {
    tableName: 'InternalApprovals',
    timestamps: true,
    indexes: [
      { fields: ['entity_type', 'entity_id'] },
      { fields: ['status'] },
      { fields: ['assigned_to_user_id'] },
      { fields: ['requested_by_user_id'] },
    ],
  });

  InternalApproval.associate = (models) => {
    InternalApproval.belongsTo(models.User, {
      foreignKey: 'requestedByUserId',
      as: 'requester',
    });
    InternalApproval.belongsTo(models.User, {
      foreignKey: 'assignedToUserId',
      as: 'assignedTo',
    });
    InternalApproval.belongsTo(models.User, {
      foreignKey: 'decidedByUserId',
      as: 'decidedBy',
    });
  };

  return InternalApproval;
};

l;
};
