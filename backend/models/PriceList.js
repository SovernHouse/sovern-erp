const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PriceList = sequelize.define('PriceList', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    currencyCode: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    validFrom: {
      type: DataTypes.DATE,
      allowNull: true
    },
    validTo: {
      type: DataTypes.DATE,
      allowNull: true
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Customer', key: 'id' }
    },
    factoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Factory', key: 'id' }
    },
    columnDefinitions: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Phase 4.28d — CRITICAL. Explicit brand context. The renderer + email
    // helper read this FIRST before falling back to factoryId.brandCode or
    // customer.brandRelationships[0]. Required for new rows (write paths
    // refuse without it); nullable on the column itself so the migration
    // can add it to legacy rows that get backfilled separately.
    //
    // The render-time guard in priceListRenderer throws if (a) brand_code is
    // missing AND no parent can supply one, OR (b) any item's
    // Product.brand_code differs from the resolved brand. Never silently
    // defaults to SH again.
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    // Phase 4.28d follow-up. List of standard column keys to HIDE from
    // the PDF + UI. Standard keys: 'unit', 'moq', 'lead', 'cost'. Pass
    // [] (default) to show every standard column; pass ['moq'] to hide
    // the Min Order column. SKU + productName + price are always shown.
    hiddenColumns: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'User', key: 'id' }
    }
  }, {
    indexes: [
      { fields: ['customer_id'] },
      { fields: ['factory_id'] },
      { fields: ['is_active'] },
      { fields: ['valid_from', 'valid_to'] }
    ]
  });

  PriceList.associate = (models) => {
    PriceList.belongsTo(models.Customer, { foreignKey: 'customerId' });
    PriceList.belongsTo(models.Factory, { foreignKey: 'factoryId' });
    PriceList.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    PriceList.hasMany(models.PriceListItem, { foreignKey: 'priceListId', as: 'items' });
  };

  return PriceList;
};
