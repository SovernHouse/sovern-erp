const { DataTypes } = require('sequelize');

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
    }
  }, {
    indexes: [
      { fields: ['po_number'] },
      { fields: ['status'] },
      { fields: ['factory_id'] },
      { fields: ['sales_order_id'] },
      { fields: ['created_at'] },
      { fields: ['factory_id', 'status'] }
    ]
  });

  return PurchaseOrder;
};
