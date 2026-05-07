const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FrontendError = sequelize.define('FrontendError', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    errorStack: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    componentStack: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pageUrl: {
      type: DataTypes.STRING(2000),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
  }, {
    tableName: 'FrontendErrors',
    updatedAt: false,
  });

  return FrontendError;
};
