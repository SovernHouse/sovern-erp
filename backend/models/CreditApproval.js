const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CreditApproval = sequelize.define('CreditApproval', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    requestedBy: {
      type: DataTypes.UUID,
      allowNull: false
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    currentLimit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    requestedLimit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    approvalNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'CreditApproval',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['customer_id'] },
      { fields: ['requested_by'] },
      { fields: ['approved_by'] },
      { fields: ['status'] },
      { fields: ['created_at'] }
    ]
  });

  return CreditApproval;
};
