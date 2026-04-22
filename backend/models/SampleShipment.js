const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SampleShipment = sequelize.define('SampleShipment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sampleRequestId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'SampleRequest',
        key: 'id'
      }
    },
    shipmentNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    shippedDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    expectedDeliveryDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    actualDeliveryDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    shippingMethod: {
      type: DataTypes.ENUM('courier', 'air_freight', 'sea_freight', 'local_delivery'),
      defaultValue: 'courier'
    },
    carrier: {
      type: DataTypes.STRING,
      allowNull: true
    },
    trackingNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'shipped', 'in_transit', 'delivered', 'failed'),
      defaultValue: 'pending'
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    weight: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true
    },
    weightUnit: {
      type: DataTypes.ENUM('kg', 'lb'),
      defaultValue: 'kg'
    },
    shippingCost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD'
    },
    shippedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['sample_request_id'] },
      { fields: ['shipment_number'] },
      { fields: ['tracking_number'] },
      { fields: ['status'] }
    ]
  });

  return SampleShipment;
};
