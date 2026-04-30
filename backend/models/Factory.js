const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Factory = sequelize.define('Factory', {
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
      defaultValue: 'Net 60'
    },
    leadTimeDays: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    rating: {
      type: DataTypes.FLOAT,
      defaultValue: 5.0,
      validate: {
        min: 0,
        max: 5
      }
    },
    certifications: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    specializations: {
      type: DataTypes.JSON,
      defaultValue: []
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
    isConfidential: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'If true, only users listed in allowedUserIds can view this factory'
    },
    allowedUserIds: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of User IDs permitted to view this factory when isConfidential=true'
    }
  }, {
    indexes: [
      { fields: ['email'] },
      { fields: ['company_name'] },
      { fields: ['is_active'] },
      { fields: ['is_confidential'] }
    ]
  });

  return Factory;
};
