const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Quotation = sequelize.define('Quotation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    quotationNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    inquiryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Inquiry',
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
    salesPersonId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'revised', 'accepted', 'rejected', 'expired'),
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
    discountType: {
      type: DataTypes.ENUM('percentage', 'fixed'),
      defaultValue: 'fixed'
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 2),
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
    validUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    terms: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    parentQuotationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Quotation',
        key: 'id'
      }
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  }, {
    indexes: [
      { fields: ['quotation_number'] },
      { fields: ['status'] },
      { fields: ['customer_id'] },
      { fields: ['inquiry_id'] },
      { fields: ['deleted_at'] }
    ]
  });

  return Quotation;
};
