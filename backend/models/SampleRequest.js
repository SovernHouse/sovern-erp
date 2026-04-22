const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SampleRequest = sequelize.define('SampleRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    requestNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Customer',
        key: 'id'
      }
    },
    requestDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    requiredByDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled'),
      defaultValue: 'pending'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium'
    },
    products: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    totalQuantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    specialRequirements: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    approvalDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['request_number'] },
      { fields: ['customer_id'] },
      { fields: ['status'] },
      { fields: ['request_date'] }
    ]
  });

  return SampleRequest;
};
