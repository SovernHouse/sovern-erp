const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Customer = sequelize.define('Customer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    contactPerson: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    paymentTerms: {
      type: DataTypes.STRING,
      defaultValue: 'Net 30'
    },
    creditLimit: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    rating: {
      type: DataTypes.FLOAT,
      defaultValue: 5.0,
      validate: {
        min: 0,
        max: 5
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    logo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    creditUsed: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    creditHold: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    creditHoldReason: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    paranoid: true, // soft deletes — sets deletedAt instead of hard-deleting
    indexes: [
      { fields: ['email'] },
      { fields: ['company_name'] },
      { fields: ['is_active'] },
      { fields: ['country'] },
      { fields: ['credit_hold'] }
    ]
  });

  return Customer;
};
