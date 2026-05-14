const { DataTypes } = require('sequelize');

/**
 * Brand — multi-brand configuration table (Phase 1, D-1 / D-8).
 *
 * Each Brand row drives:
 *   - sender identity (senderEmail, signatureHtml)
 *   - footer legal copy on outbound docs (footerLegalText)
 *   - UI theming (primaryColor, accentColor, logoUrl) read by BrandBadge + headers
 *   - template assignments (quotationTemplateId, documentTemplateIds) — placeholder in P1, wired in P3
 *   - product-category gating (acceptedProductCategories) — placeholder in P1, enforced in P3
 *
 * Brand.code is the FK target used by every transactional table. STRING(8) so
 * inspection queries read naturally ('SH' / 'FW') vs UUIDs. UNIQUE so the FK
 * is well-defined.
 *
 * JSON fields are stored raw (L-023): never JSON.stringify on writes.
 */
module.exports = (sequelize) => {
  const Brand = sequelize.define('Brand', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true,
      validate: {
        isUppercase: true,
        len: [2, 8],
      },
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    senderEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    signatureHtml: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    signatureText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    footerLegalText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    logoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    primaryColor: {
      type: DataTypes.STRING(7),
      allowNull: false,
      validate: { is: /^#[0-9A-Fa-f]{6}$/ },
    },
    accentColor: {
      type: DataTypes.STRING(7),
      allowNull: false,
      validate: { is: /^#[0-9A-Fa-f]{6}$/ },
    },
    quotationTemplateId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentTemplateIds: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    acceptedProductCategories: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // Phase 4, C15: brand-level commission rate (decimal 0..1).
    // Default 0.0500 (5%) for FW per the HanHua/FlorWay agreement
    // (locked 2026-05-14). SH defaults to 0.0000 (Alex's own business —
    // no factory commission flow). Per-quotation override via
    // Quotation.commissionRateOverride must be >= 0.0500. The floor
    // applies to FW only; SH can be zero.
    commissionRate: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0500,
    },
  });

  return Brand;
};
