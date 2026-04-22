const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Container = sequelize.define('Container', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    containerNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    containerType: {
      type: DataTypes.ENUM('20ft', '40ft', '40ft_hc'),
      allowNull: false
    },
    containerStatus: {
      type: DataTypes.ENUM('available', 'planning', 'loading', 'loaded', 'in_transit', 'delivered', 'empty', 'maintenance'),
      defaultValue: 'available'
    },
    shipmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Shipment',
        key: 'id'
      }
    },
    purchaseOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'PurchaseOrder',
        key: 'id'
      }
    },
    destinationPort: {
      type: DataTypes.STRING,
      allowNull: true
    },
    etd: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Estimated Time of Departure'
    },
    eta: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Estimated Time of Arrival'
    },
    cargoWeight: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      comment: 'Total cargo weight in kg'
    },
    maxWeight: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Maximum weight capacity in kg'
    },
    usedCapacity: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'Used capacity percentage'
    },
    palletCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    boxCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    loadingDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    departureDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    arrivalDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    seal1: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'First seal number'
    },
    seal2: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Second seal number'
    },
    carrier: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vessel: {
      type: DataTypes.STRING,
      allowNull: true
    },
    voyage: {
      type: DataTypes.STRING,
      allowNull: true
    },
    loadingWarehouse: {
      type: DataTypes.STRING,
      allowNull: true
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
      { fields: ['container_number'] },
      { fields: ['container_type'] },
      { fields: ['container_status'] },
      { fields: ['shipment_id'] },
      { fields: ['purchase_order_id'] }
    ]
  });

  return Container;
};
