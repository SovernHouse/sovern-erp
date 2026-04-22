const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Invoice = sequelize.define('Invoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    invoiceNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    salesOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'SalesOrder',
        key: 'id'
      }
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Customer',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('sales', 'purchase', 'credit_note', 'debit_note'),
      defaultValue: 'sales'
    },
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'),
      defaultValue: 'draft'
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    paidAmount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    paymentTerms: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  }, {
    indexes: [
      { fields: ['invoice_number'] },
      { fields: ['status'] },
      { fields: ['customer_id'] },
      { fields: ['sales_order_id'] },
      { fields: ['deleted_at'] },
      { fields: ['created_at'] },
      { fields: ['customer_id', 'status'] }
    ]
  });

  return Invoice;
};
