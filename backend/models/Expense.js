const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // The expenses module's main entity. One row per expense (a meal, a flight,
  // a salary line, a hotel night, etc.). Multi-currency by design — the
  // original-currency amount is the source of truth and usdAmount is the
  // converted-at-entry-date value (not re-derived later, so the FX snapshot
  // matches the existing "Expense to Alex YYYY.xlsx" sheets).
  //
  // Each row carries enough attribution to feed the client P&L report:
  //   customerId       — direct attribution (an expense for that client)
  //   factoryId        — when the expense is factory-side (inspector trip)
  //   tripId           — multi-day trip aggregation
  //   submittingOfficeId — which "office" Alex will claim this from (he has
  //                        multiple per spec; each office has its own format)
  const Expense = sequelize.define('Expense', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Who entered the expense (Alex, an assistant, the AI on Alex's behalf).
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    entryDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    // Free-text category for v1 (Salary, Bonus, Travel, Rent, Visa, Ticket,
    // Office, Flight, Taxi, Meal allowance, Hotel fee, Labour cost, etc.) —
    // matches the categories observed across Alex's existing sheets. Could be
    // tightened to an ExpenseCategory lookup later without a data migration.
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    originalCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
    },
    originalAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    // Converted-to-USD at entry date. Stored, not re-derived — locks the
    // exchange rate at submission time so historical totals don't shift.
    usdAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    fxRateUsed: {
      type: DataTypes.DECIMAL(12, 6),
      allowNull: true,
    },
    // Lifecycle. Reimbursement timing is independent of submission timing
    // (you submit → office processes → eventually pays).
    paidAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    paidByOfficeId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // Direct client attribution (drives client P&L). Nullable because some
    // expenses are general overhead (rent, salary).
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    factoryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    quotationId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    purchaseOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    inspectorId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    tripId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    submittingOfficeId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    submissionStatus: {
      type: DataTypes.ENUM('draft', 'submitted', 'paid', 'rejected', 'not_claimable'),
      defaultValue: 'draft',
      allowNull: false,
    },
    submissionBatchId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // Drive file IDs of receipt photos / supporting documents. JSON array,
    // raw values (no JSON.stringify per L-023).
    receiptDriveFileIds: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    // Set when the AI created this expense from a receipt photo.
    aiExtractedFromDriveFileId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aiExtractionConfidence: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'Expenses',
    timestamps: true,
    indexes: [
      { fields: ['user_id', 'entry_date'] },
      { fields: ['customer_id'] },
      { fields: ['factory_id'] },
      { fields: ['trip_id'] },
      { fields: ['submission_status'] },
      { fields: ['submitting_office_id'] },
      { fields: ['paid_at'] },
    ],
  });

  Expense.associate = (models) => {
    if (models.User) {
      Expense.belongsTo(models.User, { foreignKey: 'userId', as: 'enteredBy' });
      Expense.belongsTo(models.User, { foreignKey: 'inspectorId', as: 'inspector' });
    }
    if (models.Customer) {
      Expense.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
    }
    if (models.Factory) {
      Expense.belongsTo(models.Factory, { foreignKey: 'factoryId', as: 'factory' });
    }
    if (models.Quotation) {
      Expense.belongsTo(models.Quotation, { foreignKey: 'quotationId', as: 'quotation' });
    }
    if (models.PurchaseOrder) {
      Expense.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });
    }
    if (models.Trip) {
      Expense.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
    }
    if (models.ReimbursementOffice) {
      Expense.belongsTo(models.ReimbursementOffice, { foreignKey: 'submittingOfficeId', as: 'submittingOffice' });
      Expense.belongsTo(models.ReimbursementOffice, { foreignKey: 'paidByOfficeId',     as: 'paidByOffice' });
    }
    if (models.ExpenseSubmission) {
      Expense.belongsTo(models.ExpenseSubmission, { foreignKey: 'submissionBatchId', as: 'submissionBatch' });
    }
  };

  return Expense;
};
