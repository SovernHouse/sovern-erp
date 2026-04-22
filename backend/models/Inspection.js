const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Inspection = sequelize.define('Inspection', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    inspectionNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    salesOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'SalesOrder',
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
    factoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Factory',
        key: 'id'
      }
    },
    inspectorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('pre_production', 'during_production', 'pre_shipment', 'loading'),
      allowNull: false
    },
    scheduledDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'in_progress', 'passed', 'failed', 'conditional'),
      defaultValue: 'scheduled'
    },
    overallResult: {
      type: DataTypes.ENUM('pass', 'fail', 'conditional'),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  return Inspection;
};
