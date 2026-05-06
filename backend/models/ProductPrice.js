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
      allowNull: false,
      comment: 'FOB price — cost at origin port'
    },
    exwPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'EXW price — ex-works, at factory gate (before freight to port)'
    },
    priceType: {
      type: DataTypes.ENUM('FOB', 'CIF', 'EXW', 'CFR', 'DDP'),
      defaultValue: 'FOB',
      comment: 'Primary Incoterm for costPrice'
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
