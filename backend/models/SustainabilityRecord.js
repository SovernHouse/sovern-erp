const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SustainabilityRecord = sequelize.define('SustainabilityRecord', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Product',
        key: 'id'
      }
    },
    carbonFootprint: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'kg CO2 per sqm'
    },
    recycledContent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Percentage (0-100)'
    },
    localMaterials: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Percentage (0-100)'
    },
    energyRating: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'e.g., A, B, C, D, E'
    },
    waterUsage: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Liters per sqm'
    },
    certifications: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of certifications: LEED, Green Guard, FSC, etc'
    },
    factoryEnvironmentalRating: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: { min: 0, max: 5 },
      comment: 'Factory environmental rating 0-5'
    },
    transportEmissions: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'kg CO2 for standard shipment'
    },
    lastAuditDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    timestamps: true,
    underscored: true,
    tableName: 'sustainability_records',
    indexes: [
      {
        fields: ['product_id']
      }
    ]
  });

  SustainabilityRecord.associate = (models) => {
    SustainabilityRecord.belongsTo(models.Product, {
      as: 'product',
      foreignKey: 'productId'
    });
  };

  return SustainabilityRecord;
};
