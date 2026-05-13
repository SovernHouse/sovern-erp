const { DataTypes } = require('sequelize');
const { statusTransitionHook } = require('../utils/statusTransitions');

module.exports = (sequelize) => {
  const PurchaseOrder = sequelize.define('PurchaseOrder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    poNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    salesOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'SalesOrder',
        key: 'id'
      }
    },
    factoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Factory',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'confirmed', 'in_production', 'ready', 'shipped', 'received', 'completed', 'cancelled'),
      defaultValue: 'draft'
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    expectedDelivery: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Factory e-signature audit trail. Populated when the supplier
    // confirms the PO via /api/approvals/public/:token/approve.
    // signedBySupplier holds the name typed at sign time. The IP and
    // user-agent are kept on the DocumentApproval row.
    signedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    signedBySupplier: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Multi-brand (Phase 1, D-1). Inherited from parent SalesOrder at create.
    // FK to Brand.code in models/index.js.
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'SH',
    }
  }, {
    paranoid: true, // soft deletes — sets deletedAt instead of hard-deleting
    indexes: [
      { fields: ['po_number'] },
      { fields: ['status'] },
      { fields: ['factory_id'] },
      { fields: ['sales_order_id'] },
      { fields: ['created_at'] },
      { fields: ['factory_id', 'status'] }
    ]
  });

  PurchaseOrder.addHook('beforeUpdate', statusTransitionHook('PurchaseOrder'));

  return PurchaseOrder;
};
