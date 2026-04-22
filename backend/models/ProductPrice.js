const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductPrice = sequelize.define('ProductPrice', {
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
    factoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Factory',
        key: 'id'
      }
    },
    costPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    markup: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 20
    },
    sellingPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    validFrom: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    validTo: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  return ProductPrice;
};
