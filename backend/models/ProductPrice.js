/**
 * ProductPrice — temporal pricing (Phase 4.9.2b).
 *
 * Replaces the prior factory-only ProductPrice with a temporal pricing
 * row that supports per-origin OR per-factory pricing under one
 * Product, tracks the active validity window, and carries tariff
 * metadata so the landed-cost flow can compute USD-per-m² without a
 * separate join.
 *
 * Validation rule: at least ONE of factoryId or origin must be set on
 * every row (enforced in the beforeValidate hook below).
 *
 * Denormalized cache (per spec): the afterSave hook below writes
 * sellingPriceUsdPerM2 back to Product.baseFobPrice when the row is
 * the current active price for (productId, origin). Existing readers
 * of Product.baseFobPrice keep working unchanged; new readers should
 * call services/productPriceService.getCurrentPrice for origin/tariff
 * awareness.
 *
 * Indexes: (productId, origin, validFrom) for fast current-price
 * lookup. Secondary on (productId, factoryId, validFrom).
 */

const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const ProductPrice = sequelize.define('ProductPrice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Product', key: 'id' },
    },
    // Phase 4.9.2b: factory and origin are correlated but not identical
    // concepts. At least one must be set per the beforeValidate hook.
    factoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Factory', key: 'id' },
    },
    origin: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Country of origin label (e.g. China, Malaysia). Drives tariff lookup + customer-facing country-of-origin.',
    },
    costPriceUsdPerM2: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      comment: 'Factory cost in USD per square meter. Canonical storage unit; sqft is computed at render time.',
    },
    sellingPriceUsdPerM2: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      comment: 'Buyer-facing price in USD per m². Null = compute from costPriceUsdPerM2 * (1 + markupPercent).',
    },
    markupPercent: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
      comment: 'Decimal 0..1 (0.07 = 7%). Used when sellingPriceUsdPerM2 is null.',
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD',
    },
    tariffRate: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
      comment: 'Decimal 0..1 (0.407714 = 40.7714%). Optional snapshot of the tariff rate for landed-cost rendering.',
    },
    tariffDestination: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ISO2 destination for the tariffRate snapshot (e.g. US).',
    },
    validFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: () => new Date().toISOString().slice(0, 10),
    },
    validTo: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Null = current/open-ended.',
    },
    sourceNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Provenance (e.g. "Per HanHua factory quotation 2026-05-14").',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'User', key: 'id' },
    },
  }, {
    indexes: [
      { fields: ['product_id', 'origin', 'valid_from'] },
      { fields: ['product_id', 'factory_id', 'valid_from'] },
      { fields: ['valid_to'] },
    ],
    hooks: {
      beforeValidate(row) {
        // At least one of factoryId / origin must be present.
        if (!row.factoryId && !row.origin) {
          throw new Error('ProductPrice requires at least one of factoryId or origin');
        }
      },
      async afterSave(row) {
        // Denormalized cache (per spec). Resolution rule: explicit
        // selling wins, else cost*(1+markup), else cost. Skip when
        // this row is not the current active row for the
        // (productId, origin) pair.
        try {
          const db = require('./');
          if (!db.Product) return;
          const today = new Date().toISOString().slice(0, 10);
          const inWindow = row.validFrom <= today && (row.validTo == null || row.validTo > today);
          if (!inWindow) return;
          const newer = await db.ProductPrice.findOne({
            where: {
              productId: row.productId,
              origin: row.origin || null,
              validFrom: { [Op.gt]: row.validFrom },
              [Op.or]: [{ validTo: null }, { validTo: { [Op.gt]: today } }],
            },
            order: [['validFrom', 'DESC']],
          });
          if (newer) return;
          const selling = row.sellingPriceUsdPerM2 != null
            ? Number(row.sellingPriceUsdPerM2)
            : (row.markupPercent != null
                ? Number(row.costPriceUsdPerM2) * (1 + Number(row.markupPercent))
                : Number(row.costPriceUsdPerM2));
          const product = await db.Product.findByPk(row.productId);
          if (product) {
            await product.update({ baseFobPrice: selling });
          }
        } catch (_) { /* hook failure must not break the write */ }
      },
    },
  });

  return ProductPrice;
};
