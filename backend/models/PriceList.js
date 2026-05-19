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
    // Phase 4.28d second follow-up (2026-05-17). Per-PriceList header
    // override map for the standard column labels. The default English
    // names ("Cost Price", "Min Order") don't fit international trade
    // vocabulary; the operator may need "FOB", "DDP", "CIF", "Min QTY",
    // etc. Shape: { sku: 'CODE', cost: 'FOB', moq: 'MIN QTY', ... }.
    // Keys not present in the map fall back to the default label. Keys
    // are short codes matching hiddenColumns keys + 'sku', 'productName',
    // 'price'. Empty / missing value → use the built-in label.
    columnLabels: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    // Phase 4.28m (2026-05-19). Per-PriceList width override for each
    // standard or custom column. Shape: { sku: 0.30, productName: 0.32,
    // price: 0.18, ... } where each value is the column's share of the
    // page width as a decimal. Renderer normalises all visible widths
    // so they sum to 1.0; missing keys fall back to the built-in
    // default ratio. Lets the operator widen the SKU column for the
    // longer ILMY/ILCN SKUs without touching the codebase.
    columnWidths: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    // Phase 4.28d second follow-up. Free-text block rendered at the
    // bottom of the PDF (above the brand footer). Used for payment
    // terms, duty breakdown, Incoterm clarification, lead-time caveats,
    // sample policy, anything that doesn't fit a per-item column. Plain
    // text; newlines preserved. Empty / null → footer renders without
    // this section.
    //
    // Phase 4.28n (2026-05-19): new PriceLists default to the standard
    // Incoterm-flexibility note. Operator can edit or clear per list.
    // For FW/HH this lives BELOW the auto-prepended tariff disclaimer
    // the renderer adds (priceListRenderer.js line ~373).
    footerNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue:
        'Payment: 30% T/T deposit, 70% before shipment.\n'
        + 'DDP, CIF available upon request.\n'
        + 'Lead times exclude ocean freight.',
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
