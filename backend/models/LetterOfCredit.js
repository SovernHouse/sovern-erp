const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LetterOfCredit = sequelize.define('LetterOfCredit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    lcNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    supplierId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Factory',
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
    issuingBank: {
      type: DataTypes.STRING,
      allowNull: false
    },
    advisingBank: {
      type: DataTypes.STRING,
      allowNull: true
    },
    beneficiary: {
      type: DataTypes.STRING,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
      allowNull: false
    },
    issueDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'approved', 'active', 'presented', 'paid', 'cancelled', 'expired'),
      defaultValue: 'draft'
    },
    type: {
      type: DataTypes.ENUM('sight', 'usance', 'revolving', 'standby'),
      defaultValue: 'sight'
    },
    terms: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    paymentTerms: {
      type: DataTypes.ENUM('at_sight', 'days_30', 'days_60', 'days_90', 'days_120'),
      defaultValue: 'at_sight'
    },
    tolerance: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      allowNull: true
    },
    toleranceType: {
      type: DataTypes.ENUM('percentage', 'amount'),
      defaultValue: 'percentage'
    },
    partialShipment: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    transhipmentAllowed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    incoterm: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    presentedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    presentedDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    paidAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    paidDate: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['lc_number'] },
      { fields: ['status'] },
      { fields: ['supplier_id'] },
      { fields: ['customer_id'] },
      { fields: ['expiry_date'] },
      { fields: ['issuing_bank'] }
    ]
  });

  return LetterOfCredit;
};
