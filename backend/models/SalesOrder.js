const { DataTypes } = require('sequelize');
const { statusTransitionHook } = require('../utils/statusTransitions');

module.exports = (sequelize) => {
  const SalesOrder = sequelize.define('SalesOrder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    proformaInvoiceId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'ProformaInvoice',
        key: 'id'
      }
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Customer',
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
      type: DataTypes.ENUM('confirmed', 'in_production', 'ready', 'shipped', 'in_transit', 'delivered', 'completed', 'cancelled'),
      defaultValue: 'confirmed'
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    tax: {
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
    paymentStatus: {
      type: DataTypes.ENUM('unpaid', 'partial', 'paid'),
      defaultValue: 'unpaid'
    },
    estimatedDelivery: {
      type: DataTypes.DATE,
      allowNull: true
    },
    actualDelivery: {
      type: DataTypes.DATE,
      allowNull: true
    },
    shippingMethod: {
      type: DataTypes.STRING,
      allowNull: true
    },
    trackingNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Client e-signature audit trail. Populated when the customer
    // approves the SO via /api/approvals/public/:token/approve.
    // signedByClient stores the name typed at sign time. The IP and
    // user-agent are kept on the DocumentApproval row.
    signedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    signedByClient: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Multi-brand (Phase 1, D-1). Inherited from parent quotation at create.
    // FK to Brand.code in models/index.js.
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'SH',
    }
  }, {
    paranoid: true, // soft deletes — sets deletedAt instead of hard-deleting
    indexes: [
      { fields: ['order_number'] },
      { fields: ['status'] },
      { fields: ['customer_id'] },
      { fields: ['factory_id'] },
      { fields: ['created_at'] },
      { fields: ['customer_id', 'status'] }
    ]
  });

  SalesOrder.addHook('beforeUpdate', statusTransitionHook('SalesOrder'));

  return SalesOrder;
};
