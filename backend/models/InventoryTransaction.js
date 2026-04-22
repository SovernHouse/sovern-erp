const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InventoryTransaction = sequelize.define('InventoryTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    inventoryItemId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'InventoryItem',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('in', 'out', 'adjustment', 'transfer'),
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: true
    },
    referenceType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    performedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    }
  });

  return InventoryTransaction;
};
