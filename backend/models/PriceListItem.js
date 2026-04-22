const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PriceListItem = sequelize.define('PriceListItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    priceListId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'PriceList', key: 'id' }
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Product', key: 'id' }
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true
    },
    productName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    sellingPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    costPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    minimumOrder: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    leadTimeDays: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    margin: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'sqm'
    },
    customColumns: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['price_list_id'] },
      { fields: ['product_id'] },
      { fields: ['price_list_id', 'product_id'] }
    ]
  });

  PriceListItem.associate = (models) => {
    PriceListItem.belongsTo(models.PriceList, { foreignKey: 'priceListId' });
    PriceListItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return PriceListItem;
};
