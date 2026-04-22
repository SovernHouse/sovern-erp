const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WarehouseLocation = sequelize.define('WarehouseLocation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    warehouseId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to warehouse facility'
    },
    zone: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'e.g., A, B, C - warehouse zone'
    },
    aisle: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'e.g., 01, 02 - aisle number'
    },
    rack: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'e.g., R1, R2 - rack identifier'
    },
    shelf: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'e.g., 1-5 - shelf level'
    },
    bin: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'e.g., A-D - bin position'
    },
    type: {
      type: DataTypes.ENUM('bulk', 'picking', 'staging', 'receiving', 'returns'),
      allowNull: false,
      defaultValue: 'bulk'
    },
    maxWeight: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Maximum weight in kg'
    },
    maxPallets: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: 'Maximum number of pallets'
    },
    currentPallets: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Current number of pallets'
    },
    currentWeight: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      comment: 'Current weight in kg'
    },
    status: {
      type: DataTypes.ENUM('active', 'full', 'maintenance', 'inactive'),
      defaultValue: 'active'
    },
    temperature: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Temperature in Celsius for climate-controlled areas'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['warehouse_id'] },
      { fields: ['zone', 'aisle', 'rack', 'shelf', 'bin'] },
      { fields: ['type'] },
      { fields: ['status'] }
    ]
  });

  return WarehouseLocation;
};
