const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ComplianceRecord = sequelize.define('ComplianceRecord', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    shipmentId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('anti_dumping', 'cpsc', 'ce_marking', 'customs'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'flagged', 'expired'),
      defaultValue: 'pending'
    },
    countryOrigin: {
      type: DataTypes.STRING,
      allowNull: false
    },
    countryDestination: {
      type: DataTypes.STRING,
      allowNull: false
    },
    hsCode: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    dutyRate: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      comment: 'Duty rate as percentage'
    },
    antiDumpingRate: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      comment: 'Anti-dumping duty rate as percentage'
    },
    complianceDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    certificateNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['shipment_id'] },
      { fields: ['product_id'] },
      { fields: ['type'] },
      { fields: ['status'] },
      { fields: ['country_origin'] },
      { fields: ['country_destination'] },
      { fields: ['hs_code'] },
      { fields: ['expiry_date'] }
    ]
  });

  return ComplianceRecord;
};
