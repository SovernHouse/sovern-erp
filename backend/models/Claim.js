const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Claim = sequelize.define('Claim', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    claimNumber: {
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
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Customer',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('quality', 'damage', 'shortage', 'wrong_item', 'delay', 'other'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('submitted', 'under_review', 'investigating', 'resolved', 'rejected', 'closed'),
      defaultValue: 'submitted'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    resolution: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    compensationType: {
      type: DataTypes.ENUM('replacement', 'refund', 'credit', 'repair'),
      allowNull: true
    },
    compensationAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    submittedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  });

  return Claim;
};
