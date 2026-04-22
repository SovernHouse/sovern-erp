const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommissionRule = sequelize.define('CommissionRule', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ruleType: {
      type: DataTypes.ENUM('percentage', 'fixed', 'tiered'),
      allowNull: false,
      comment: 'Type of commission calculation'
    },
    baseValue: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      comment: 'Base percentage or amount'
    },
    minAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Minimum order amount to qualify'
    },
    maxAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Maximum order amount for this tier'
    },
    tiers: {
      type: DataTypes.JSON,
      defaultValue: null,
      allowNull: true,
      comment: 'Tiered commission structure: [{minAmount, maxAmount, rate}]'
    },
    applicableRoles: {
      type: DataTypes.JSON,
      defaultValue: ['sales'],
      allowNull: false,
      comment: 'Roles that qualify for this commission'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    indexes: [
      { fields: ['is_active'] },
      { fields: ['rule_type'] }
    ]
  });

  return CommissionRule;
};
