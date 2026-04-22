const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductBatch = sequelize.define('ProductBatch', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    batchNumber: {
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
    supplierId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Factory',
        key: 'id'
      }
    },
    shadeCode: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Shade code to identify color variation'
    },
    shadeName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    caliberCode: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Caliber code for size grading'
    },
    productionDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    manufacturingLocation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    totalQuantity: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    unit: {
      type: DataTypes.STRING,
      defaultValue: 'sqm'
    },
    quantityReceived: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    quantityAllocated: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    quantityAvailable: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    warehouseLocation: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Warehouse shelf/location code'
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_transit', 'received', 'stored', 'partially_allocated', 'fully_allocated', 'quarantined', 'expired'),
      defaultValue: 'pending'
    },
    qualityStatus: {
      type: DataTypes.ENUM('pending_inspection', 'approved', 'rejected', 'conditional_approval'),
      defaultValue: 'pending_inspection'
    },
    inspectionDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    inspectionNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    batchCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    costPerUnit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    }
  }, {
    indexes: [
      { fields: ['batch_number'] },
      { fields: ['product_id'] },
      { fields: ['shade_code'] },
      { fields: ['status'] },
      { fields: ['production_date'] },
      { fields: ['warehouse_location'] }
    ]
  });

  return ProductBatch;
};
