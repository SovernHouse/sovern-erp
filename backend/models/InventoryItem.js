const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InventoryItem = sequelize.define('InventoryItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Product',
        key: 'id'
      }
    },
    warehouseLocation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    reservedQty: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    availableQty: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    reorderLevel: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    reorderQty: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    lastStockCheck: {
      type: DataTypes.DATE,
      allowNull: true
    }
  });

  return InventoryItem;
};
