const { DataTypes } = require('sequelize');
const { statusTransitionHook } = require('../utils/statusTransitions');

module.exports = (sequelize) => {
  const ProformaInvoice = sequelize.define('ProformaInvoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    piNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    quotationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Quotation',
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
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'confirmed', 'cancelled'),
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
    paymentTerms: {
      type: DataTypes.STRING,
      defaultValue: 'Net 30'
    },
    bankDetails: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    validUntil: {
      type: DataTypes.DATE,
      allowNull: true
    }
  });

  ProformaInvoice.addHook('beforeUpdate', statusTransitionHook('ProformaInvoice'));

  return ProformaInvoice;
};
