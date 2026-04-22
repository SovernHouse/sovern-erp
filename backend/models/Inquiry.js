const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Inquiry = sequelize.define('Inquiry', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    inquiryNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
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
      type: DataTypes.ENUM('new', 'in_review', 'quoted', 'follow_up', 'converted', 'lost', 'cancelled'),
      defaultValue: 'new'
    },
    source: {
      type: DataTypes.ENUM('web', 'email', 'phone', 'portal'),
      defaultValue: 'email'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    followUpDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    convertedToQuotationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Quotation',
        key: 'id'
      }
    },
    estimatedValue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['inquiry_number'] },
      { fields: ['status'] },
      { fields: ['customer_id'] },
      { fields: ['sales_person_id'] }
    ]
  });

  return Inquiry;
};
