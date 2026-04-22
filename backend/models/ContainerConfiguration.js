const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContainerConfiguration = sequelize.define('ContainerConfiguration', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    containerType: {
      type: DataTypes.ENUM('20ft', '40ft', '40ft_hc'),
      allowNull: false,
      unique: true
    },
    internalLength: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      comment: 'Internal length in meters'
    },
    internalWidth: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      comment: 'Internal width in meters'
    },
    internalHeight: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      comment: 'Internal height in meters'
    },
    maxPayloadWeight: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Maximum payload weight in kg'
    },
    volume: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Volume in cubic meters'
    },
    standardPalletCapacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Standard pallet capacity (EUR/EPAL 1200x800)'
    },
    doorWidth: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    doorHeight: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    optimizationNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    indexes: [
      { fields: ['container_type'] }
    ]
  });

  return ContainerConfiguration;
};
