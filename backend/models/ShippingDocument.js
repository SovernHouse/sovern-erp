const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ShippingDocument = sequelize.define('ShippingDocument', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    salesOrderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'SalesOrder',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('bill_of_lading', 'airway_bill', 'certificate_of_origin', 'insurance', 'customs', 'phytosanitary', 'fumigation', 'inspection_cert', 'other'),
      allowNull: false
    },
    documentNumber: {
      type: DataTypes.STRING,
      allowNull: false
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    uploadedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    issuedDate: {
      type: DataTypes.DATE,
      allowNull: true
    }
  });

  return ShippingDocument;
};
