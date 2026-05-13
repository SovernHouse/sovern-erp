const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ReimbursementOffice = sequelize.define('ReimbursementOffice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Short code used internally and on report headers (e.g. SOVERN_TW).
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    defaultCurrency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
    },
    claimsFrequency: {
      type: DataTypes.ENUM('monthly', 'quarterly', 'ad_hoc'),
      defaultValue: 'ad_hoc',
    },
    // Whitelist of expense categories this office accepts. Empty = all
    // categories. Stored as JSON array of strings (no JSON.stringify per L-023).
    acceptedCategories: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    // Which exporter to use when generating reports for this office.
    // NULLABLE — Alex sets it on the first report run when he picks a template.
    exportTemplateKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Multi-brand (Phase 1 Commit 3b-A). Each reimbursement office belongs
    // to ONE brand — SH offices reimburse SH expenses, FW offices reimburse
    // FW expenses. Mixing across the two distinct legal entities is not
    // allowed.
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'SH',
    },
  }, {
    tableName: 'ReimbursementOffices',
    timestamps: true,
    indexes: [
      { fields: ['code'], unique: true },
      { fields: ['is_active'] },
    ],
  });

  return ReimbursementOffice;
};
