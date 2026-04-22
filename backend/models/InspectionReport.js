const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InspectionReport = sequelize.define('InspectionReport', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    inspectionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Inspection',
        key: 'id'
      }
    },
    reportNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    findings: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    recommendations: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    generatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  });

  return InspectionReport;
};
