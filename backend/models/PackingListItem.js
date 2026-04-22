const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PackingListItem = sequelize.define('PackingListItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    packingListId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'PackingList',
        key: 'id'
      }
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Product',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    unit: {
      type: DataTypes.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
      defaultValue: 'sqm'
    },
    packageNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    grossWeight: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    netWeight: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    dimensions: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    marks: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  return PackingListItem;
};
