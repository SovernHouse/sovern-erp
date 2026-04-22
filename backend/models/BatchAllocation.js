const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BatchAllocation = sequelize.define('BatchAllocation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    productBatchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ProductBatch',
        key: 'id'
      }
    },
    salesOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'SalesOrder',
        key: 'id'
      }
    },
    purchaseOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'PurchaseOrder',
        key: 'id'
      }
    },
    allocatedQuantity: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    unit: {
      type: DataTypes.STRING,
      defaultValue: 'sqm'
    },
    allocationDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    requiredDeliveryDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('allocated', 'reserved', 'picked', 'shipped', 'delivered', 'cancelled'),
      defaultValue: 'allocated'
    },
    pickedQuantity: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    pickedDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    shippedQuantity: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    shippedDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deliveredQuantity: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    deliveredDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    allocatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    }
  }, {
    indexes: [
      { fields: ['product_batch_id'] },
      { fields: ['sales_order_id'] },
      { fields: ['purchase_order_id'] },
      { fields: ['status'] },
      { fields: ['allocation_date'] }
    ]
  });

  return BatchAllocation;
};
