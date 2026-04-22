const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Shipment = sequelize.define('Shipment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    salesOrderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'SalesOrder',
        key: 'id'
      }
    },
    shipmentNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    carrier: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vesselName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    voyageNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    containerNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    containerType: {
      type: DataTypes.ENUM('20ft', '40ft', '40hc', 'LCL'),
      allowNull: true
    },
    portOfLoading: {
      type: DataTypes.STRING,
      allowNull: true
    },
    portOfDischarge: {
      type: DataTypes.STRING,
      allowNull: true
    },
    etd: {
      type: DataTypes.DATE,
      allowNull: true
    },
    eta: {
      type: DataTypes.DATE,
      allowNull: true
    },
    actualDeparture: {
      type: DataTypes.DATE,
      allowNull: true
    },
    actualArrival: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('booked', 'loaded', 'in_transit', 'at_port', 'customs', 'delivered'),
      defaultValue: 'booked'
    },
    currentLocation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    trackingUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    actualDeliveryDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deliveryNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    proofOfDeliveryReference: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['status'] },
      { fields: ['sales_order_id'] },
      { fields: ['created_at'] }
    ]
  });

  return Shipment;
};
