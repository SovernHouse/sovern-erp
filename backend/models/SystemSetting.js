const { DataTypes } = require('sequelize');

/**
 * SystemSetting — single-row company-wide configuration (Phase 4.8, Commit 1).
 *
 * Previously the company settings lived in a module-scoped `let` literal in
 * settingsRoutes.js, which meant every backend boot re-initialised the
 * values to the hardcoded defaults and wiped Alex's saved edits. This model
 * replaces that with a real DB-backed singleton row.
 *
 * Singleton pattern: the table is expected to contain exactly one row.
 * getOrCreateSettings() returns the row, creating it with the legacy
 * defaults on first call. Update operations mutate the row in place. There
 * is no list endpoint, no delete endpoint, no multi-row semantics.
 *
 * Schema mirrors the previous in-memory shape so the existing frontend
 * GeneralSettings page works without changes.
 */
module.exports = (sequelize) => {
  const SystemSetting = sequelize.define('SystemSetting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Singleton marker. Always 'company'. Indexed UNIQUE so a second row can
    // never accidentally appear via a race in getOrCreateSettings.
    key: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      defaultValue: 'company',
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Trading ERP',
    },
    companyEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isEmail: true },
    },
    companyPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    companyAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    companyCity: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    companyCountry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    companyLogo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'USD',
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Asia/Taipei',
    },
    language: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'en',
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    defaultPaymentTerms: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Net 30',
    },
  });

  return SystemSetting;
};
