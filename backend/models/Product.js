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
    // Phase 4.15c-1: per-unit shipping volume in cubic meters. Drives the
    // optimizeContainerLoad math and feeds packing-list / shipment-document
    // generation. Nullable so legacy rows stay valid; the container
    // optimizer flags lines whose product has no cube data.
    cubicMeters: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      comment: 'Per-unit shipping volume (cbm). Used by container loading optimizer + packing lists.',
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
      type: DataTypes.ENUM('lvt', 'spc', 'wpc', 'engineered_spc', 'hardwood', 'laminate', 'tile', 'ceramic', 'other'),
      allowNull: true,
      comment: 'Catalog filter dimension. Coexists with categoryId FK (existing hierarchy). engineered_spc is a thicker/multi-ply SPC subtype (e.g. IronLite Core).',
    },
    baseFobPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Buyer-facing FOB price (USD per unit) for single-origin Products. ALREADY INCLUDES Alex\'s commission for FW/HH per the no-markup invariant; do NOT multiply by 1.07 / divide by (1-0.07). For multi-origin Products (e.g. IronLite Core which ships from both FW Malaysia and HH China) read originVariants[].fobPriceUsd keyed by originCountry instead — this column carries only one of the origins. Quotation line items default to the matching origin variant; super_admin can quote below with a reason.',
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
      comment: 'ISO-2 country code, e.g. MY, CN. Default/primary origin; the originVariants JSON below carries per-origin pricing when the same SKU is sourced from multiple countries (Phase 4.9 C-1).',
    },
    // Phase 4.9 C-1: multi-origin pricing. Each entry =
    //   { originCountry, fobPriceUsd, priceUnit, moqOverride?, leadTimeOverride? }
    // priceUnit is a single canonical unit (sqm | sqft | box | pallet | roll | piece).
    // Quotation builder reads from here when present and falls back to
    // baseFobPrice + originCountry on the row when empty (backwards compat).
    // Backfilled for existing rows by migrateProductOriginVariantsC49a.
    originVariants: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: false,
      comment: 'Array of per-origin pricing variants. Raw JSON per L-023 (no JSON.stringify).',
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
