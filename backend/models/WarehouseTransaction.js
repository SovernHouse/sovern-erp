const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WarehouseTransaction = sequelize.define('WarehouseTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    type: {
      type: DataTypes.ENUM('receive', 'putaway', 'pick', 'pack', 'transfer', 'adjust', 'count'),
      allowNull: false
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    batchId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    fromLocationId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    toLocationId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    unit: {
      type: DataTypes.STRING,
      defaultValue: 'pcs',
      comment: 'pcs, kg, box, pallet, etc.'
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'PO, SO, GRN, or other reference number'
    },
    performedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'User ID'
    },
    reasonCode: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'For adjustments: damage, returns, theft, etc.'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    indexes: [
      { fields: ['type'] },
      { fields: ['product_id'] },
      { fields: ['batch_id'] },
      { fields: ['from_location_id'] },
      { fields: ['to_location_id'] },
      { fields: ['performed_by'] },
      { fields: ['timestamp'] },
      { fields: ['reference'] }
    ]
  });

  return WarehouseTransaction;
};
