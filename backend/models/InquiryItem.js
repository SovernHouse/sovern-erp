const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InquiryItem = sequelize.define('InquiryItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    inquiryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Inquiry',
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
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    unit: {
      type: DataTypes.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
      defaultValue: 'sqm'
    },
    targetPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    specifications: {
      type: DataTypes.JSON,
      allowNull: true
    }
  });

  return InquiryItem;
};
