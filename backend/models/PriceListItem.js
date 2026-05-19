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
    },
    // Phase 4.28k (2026-05-19): explicit row order for the editor + PDF.
    // Default queries ORDER BY display_order ASC, sku ASC so the
    // ASCII-lex fallback on SKUs like IL-180x1220-10.0mm vs -6.5mm
    // doesn't surface again. Backfilled by migrate428kPriceListItem
    // DisplayOrder which extracts -N.NNmm thickness from SKU/productName
    // when available, otherwise preserves insertion order.
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Explicit row order in the PriceListItem table for editor + PDF. Lower number renders first. NULL falls back to sku ASC.',
    }
  }, {
    indexes: [
      { fields: ['price_list_id'] },
      { fields: ['product_id'] },
      { fields: ['price_list_id', 'product_id'] },
      { fields: ['price_list_id', 'display_order'] }
    ]
  });

  PriceListItem.associate = (models) => {
    PriceListItem.belongsTo(models.PriceList, { foreignKey: 'priceListId' });
    PriceListItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return PriceListItem;
};
