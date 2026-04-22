const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GoodsReceivedNote = sequelize.define('GoodsReceivedNote', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    grnNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    poId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'PurchaseOrder',
        key: 'id'
      }
    },
    receivedDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    receivedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    items: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of received items: [{productId, skuCode, quantity, quantityReceived, unitPrice, remarks}]'
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'partial'),
      defaultValue: 'pending'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    warehouseLocation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    inspectionStatus: {
      type: DataTypes.ENUM('pending', 'passed', 'failed', 'conditional'),
      allowNull: true
    },
    inspectionNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['po_id'] },
      { fields: ['status'] },
      { fields: ['received_date'] }
    ]
  });

  return GoodsReceivedNote;
};
