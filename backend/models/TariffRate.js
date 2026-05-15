const { DataTypes } = require('sequelize');

/**
 * TariffRate — Phase 4.9 C-2.
 *
 * Tracks import duty rates by (originCountry, destinationCountry) so
 * the quotation builder can compute landed-USA cost on USA-destination
 * quotes and warn when the rate is expiring. US tariff policy is
 * volatile in 2026 (Section 301 + IEEPA + reciprocal stacks change
 * monthly), so rows carry an explicit effectiveUntil and the UI hard-
 * warns past that date instead of silently quoting a stale number.
 *
 * Brand scope: brandCode is nullable. NULL = applies to all brands
 * (the common case for country-level tariffs). A non-null brandCode
 * lets us record brand-specific overrides if/when a single trading
 * partner cuts a different deal — rare today but the column avoids a
 * migration later.
 *
 * Lookup pattern: ORDER BY effectiveUntil DESC LIMIT 1 returns the
 * most recent rate. The composite index supports the (origin, dest,
 * brand) -> latest lookup the quotation builder calls per line item.
 */
module.exports = (sequelize) => {
  const TariffRate = sequelize.define('TariffRate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    originCountry: {
      type: DataTypes.STRING(2),
      allowNull: false,
      comment: 'ISO-2 country code. CN, MY, ID, TW, etc.',
    },
    destinationCountry: {
      type: DataTypes.STRING(2),
      allowNull: false,
      comment: 'ISO-2 country code. US, GB, EU country codes individually, etc.',
    },
    ratePercent: {
      type: DataTypes.DECIMAL(7, 4),
      allowNull: false,
      validate: { min: 0, max: 999.9999 },
      comment: 'Combined import duty as a percentage (40.7714 = 40.7714%, NOT 0.407714). Includes MFN base + Section 301 + IEEPA + reciprocal + any AD/CVD stacks if applicable. Source documented in sourceNote.',
    },
    effectiveFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Date the rate became active. Asia/Taipei calendar date.',
    },
    effectiveUntil: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Hard expiry — UI warns past this date. Always set; US tariff policy moves fast enough that an indefinite rate is dangerous.',
    },
    sourceNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Free-text provenance. e.g. "HanHua factory note May 14, 2026" or "USTR Reciprocal Tariff Order 2026-04-15".',
    },
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: true,
      comment: 'NULL = applies to all brands (default). Set to SH or FW for brand-specific overrides.',
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: true,
      // FK declared in models/index.js per L-034.
    },
  }, {
    tableName: 'TariffRates',
    timestamps: true,
    indexes: [
      { fields: ['origin_country', 'destination_country', 'effective_until'] },
      { fields: ['effective_until'] },
      { fields: ['brand_code'] },
    ],
  });

  TariffRate.associate = (models) => {
    if (models.User) {
      TariffRate.belongsTo(models.User, { foreignKey: 'createdById', as: 'createdBy', constraints: false });
    }
    if (models.Brand) {
      // brandCode -> Brand.code, constraints:false per L-043 (lookup table FK)
      TariffRate.belongsTo(models.Brand, { foreignKey: 'brandCode', targetKey: 'code', as: 'brand', constraints: false });
    }
  };

  return TariffRate;
};
