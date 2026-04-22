const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LandedCostTemplate = sequelize.define('LandedCostTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    supplierId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Factory',
        key: 'id'
      }
    },
    countryOfOrigin: {
      type: DataTypes.STRING,
      allowNull: true
    },
    destinationCountry: {
      type: DataTypes.STRING,
      allowNull: true
    },
    components: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        productCost: 0,
        freight: 0,
        insurance: 0,
        customsDuty: 0,
        handlingCharges: 0,
        localDelivery: 0
      }
    },
    defaultPercentages: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        freightPercent: 5,
        insurancePercent: 1,
        customsDutyPercent: 10,
        handlingChargesPercent: 2,
        localDeliveryPercent: 3
      }
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    }
  }, {
    indexes: [
      { fields: ['name'] },
      { fields: ['supplier_id'] },
      { fields: ['is_active'] }
    ]
  });

  return LandedCostTemplate;
};
