const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CustomerAddress = sequelize.define('CustomerAddress', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Customer',
        key: 'id'
      }
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'e.g., Main Office, Warehouse, Branch'
    },
    addressLine1: {
      type: DataTypes.STRING,
      allowNull: false
    },
    addressLine2: {
      type: DataTypes.STRING,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true
    },
    postalCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false
    },
    contactName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    contactPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isEmail: true }
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Primary address for correspondence'
    },
    isShipping: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Use for shipping'
    },
    isBilling: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Use for billing'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    timestamps: true,
    underscored: true,
    tableName: 'customer_addresses',
    indexes: [
      {
        fields: ['customer_id']
      },
      {
        fields: ['customer_id', 'is_default']
      }
    ]
  });

  CustomerAddress.associate = (models) => {
    CustomerAddress.belongsTo(models.Customer, {
      as: 'customer',
      foreignKey: 'customerId'
    });
  };

  return CustomerAddress;
};
