const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuotationItem = sequelize.define('QuotationItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    quotationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Quotation',
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
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    discount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  return QuotationItem;
};
