const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ShipmentTracking = sequelize.define('ShipmentTracking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    shipmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Shipment',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    }
  });

  return ShipmentTracking;
};
