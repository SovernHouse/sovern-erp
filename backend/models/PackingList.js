const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PackingList = sequelize.define('PackingList', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    packingListNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    salesOrderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'SalesOrder',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('draft', 'confirmed'),
      defaultValue: 'draft'
    },
    totalPackages: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    totalGrossWeight: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    totalNetWeight: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    totalVolume: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  }, {
    indexes: [
      { fields: ['packing_list_number'] },
      { fields: ['status'] },
      { fields: ['sales_order_id'] },
      { fields: ['deleted_at'] }
    ]
  });

  return PackingList;
};
