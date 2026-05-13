const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // A single batch report sent to one ReimbursementOffice. Group of Expense
  // rows submitted as one claim. The exporter generates an XLSX from the
  // grouped expenses, saves it to Drive, and stamps exportFileDriveFileId.
  const ExpenseSubmission = sequelize.define('ExpenseSubmission', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    officeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // The reporting window this submission covers (inclusive on both ends).
    periodStart: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    periodEnd: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    exportFileDriveFileId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Snapshot of per-currency totals at generation time. Frozen — the source
    // expense rows can change later but this snapshot stays accurate.
    totalsByCurrency: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Who created the submission.
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // Multi-brand (Phase 1 Commit 3b-A). Submission inherits brand from
    // the office it routes to — keeps the XLSX report cleanly per-brand.
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'SH',
    },
  }, {
    tableName: 'ExpenseSubmissions',
    timestamps: true,
    indexes: [
      { fields: ['office_id', 'period_start'] },
      { fields: ['user_id'] },
      { fields: ['submitted_at'] },
      { fields: ['paid_at'] },
    ],
  });

  ExpenseSubmission.associate = (models) => {
    if (models.User) {
      ExpenseSubmission.belongsTo(models.User, { foreignKey: 'userId', as: 'creator' });
    }
    if (models.ReimbursementOffice) {
      ExpenseSubmission.belongsTo(models.ReimbursementOffice, { foreignKey: 'officeId', as: 'office' });
    }
    if (models.Expense) {
      ExpenseSubmission.hasMany(models.Expense, { foreignKey: 'submissionBatchId', as: 'expenses' });
    }
  };

  return ExpenseSubmission;
};
