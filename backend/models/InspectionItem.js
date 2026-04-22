const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InspectionItem = sequelize.define('InspectionItem', {
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
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Product',
        key: 'id'
      }
    },
    checkPoint: {
      type: DataTypes.STRING,
      allowNull: false
    },
    criteria: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    result: {
      type: DataTypes.ENUM('pass', 'fail', 'na'),
      allowNull: true
    },
    value: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: []
    }
  });

  return InspectionItem;
};
