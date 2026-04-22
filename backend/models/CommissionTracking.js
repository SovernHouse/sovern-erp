const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommissionTracking = sequelize.define('CommissionTracking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    commissionRuleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'CommissionRules',
        key: 'id'
      }
    },
    salesOrderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'SalesOrders',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Commission amount earned'
    },
    percentage: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      comment: 'Commission percentage applied'
    },
    orderAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Order total amount'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'paid', 'disputed', 'cancelled'),
      defaultValue: 'pending'
    },
    paidDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'status'] },
      { fields: ['sales_order_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] }
    ]
  });

  return CommissionTracking;
};
