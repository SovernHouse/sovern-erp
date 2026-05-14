const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    salesDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Client-facing description shown on quotations and sales orders'
    },
    purchaseDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Supplier-facing description shown on purchase orders — may include QC requirements, tolerances, certifications'
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    factoryId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    unit: {
      type: DataTypes.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
      defaultValue: 'sqm'
    },
    specifications: {
      type: DataTypes.JSON,
      defaultValue: {
        thickness: null,
        width: null,
        length: null,
        material: null,
        finish: null,
        color: null,
        wearLayer: null,
        acRating: null,
        species: null,
        grade: null,
        construction: null,
        clickSystem: null
      }
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    minOrderQty: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1
    },
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    hsCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    // Phase 4, C14: brand-aware catalog. brandCode FK to Brand.code per L-043
    // (constraints:false declared in models/index.js). Defaults to 'SH' so
    // pre-Phase-4 rows backfill cleanly via migrateBrands.
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'SH',
      comment: 'Brand the product belongs to. Quotation line items can only pick products of the same brand.',
    },
    // Phase 4 spec said per-brand sku uniqueness. SQLite cannot ALTER a
    // column-level UNIQUE on `sku` without a full table rebuild (31 live
    // rows + many FK relations). Pragmatic compromise: SKU stays GLOBALLY
    // unique (legacy column-level UNIQUE preserved); seed data uses brand
    // prefixes (FW-*, SH-*) so collisions don't occur in practice. Per-brand
    // SKU uniqueness deferred to a Phase 5 table rebuild.
    productType: {
      type: DataTypes.ENUM('lvt', 'spc', 'wpc', 'hardwood', 'laminate', 'tile', 'ceramic', 'other'),
      allowNull: true,
      comment: 'Catalog filter dimension. Coexists with categoryId FK (existing hierarchy).',
    },
    baseFobPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Buyer-facing FOB price floor (USD per unit). ALREADY INCLUDES Alex\'s commission per the no-markup invariant. Quotation line items default to this; super_admin can quote below with a reason.',
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
    },
    moqUnit: {
      type: DataTypes.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece', 'container'),
      allowNull: true,
    },
    leadTimeDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    certifications: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of {name, issuer, expiresAt}. Raw JSON per L-023 (no JSON.stringify).',
    },
    originCountry: {
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: 'ISO-2 country code, e.g. MY, CN.',
    }
  }, {
    indexes: [
      { fields: ['name'] },
      { fields: ['sku'] },
      { fields: ['category_id'] },
      { fields: ['factory_id'] },
      { fields: ['is_active'] },
      { fields: ['deleted_at'] },
      { fields: ['created_at'] },
      // Phase 4, C14: brand-scope and catalog filter
      { fields: ['brand_code'] },
      { fields: ['product_type'] },
      { fields: ['brand_code', 'sku'] },
    ]
  });

  return Product;
};
