const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LandedCostCalculation = sequelize.define('LandedCostCalculation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    referenceNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Product',
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
    supplierId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Factory',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: false
    },
    productCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    freight: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0
    },
    insurance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0
    },
    customsDuty: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0
    },
    handlingCharges: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0
    },
    localDelivery: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0
    },
    totalLandedCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    costPerUnit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
      allowNull: false
    },
    exchangeRate: {
      type: DataTypes.DECIMAL(10, 6),
      defaultValue: 1,
      allowNull: true
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'LandedCostTemplate',
        key: 'id'
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['reference_number'] },
      { fields: ['product_id'] },
      { fields: ['supplier_id'] },
      { fields: ['purchase_order_id'] }
    ]
  });

  return LandedCostCalculation;
};
