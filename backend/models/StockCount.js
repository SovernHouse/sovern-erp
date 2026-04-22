const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StockCount = sequelize.define('StockCount', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    warehouseId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Warehouse being counted'
    },
    zone: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Specific zone if partial count'
    },
    status: {
      type: DataTypes.ENUM('planned', 'in_progress', 'completed', 'cancelled'),
      defaultValue: 'planned'
    },
    countDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    countedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'User who performed the count'
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'User who approved the count'
    },
    varianceReport: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Variance analysis: {total_variance: 0.5, variance_pct: 0.01, discrepancies: []}'
    },
    totalCountedItems: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    totalSystemItems: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    discrepancyCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['warehouse_id'] },
      { fields: ['status'] },
      { fields: ['count_date'] },
      { fields: ['counted_by'] }
    ]
  });

  return StockCount;
};
