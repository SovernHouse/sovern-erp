const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CertificateOfOrigin = sequelize.define('CertificateOfOrigin', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    shipmentId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    exporterName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    exporterAddress: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    consigneeName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    importerName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    countryOfOrigin: {
      type: DataTypes.STRING(2),
      allowNull: false,
      comment: 'ISO country code'
    },
    countryOfDestination: {
      type: DataTypes.STRING(2),
      allowNull: false,
      comment: 'ISO country code'
    },
    transportDetails: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Details of transportation method'
    },
    items: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: 'Array of items: [{"hs_code": "690120", "description": "...", "quantity": 1000, "unit": "pcs"}]'
    },
    certNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Certificate number'
    },
    issueDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    chamberOfCommerce: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Issuing chamber of commerce'
    },
    status: {
      type: DataTypes.ENUM('draft', 'issued', 'used', 'expired', 'cancelled'),
      defaultValue: 'draft'
    },
    signatureField: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Path or URI of digital signature'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['shipment_id'] },
      { fields: ['cert_number'] },
      { fields: ['status'] },
      { fields: ['country_of_origin'] },
      { fields: ['country_of_destination'] }
    ]
  });

  return CertificateOfOrigin;
};
