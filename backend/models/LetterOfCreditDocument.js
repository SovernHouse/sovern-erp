const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LetterOfCreditDocument = sequelize.define('LetterOfCreditDocument', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    letterOfCreditId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'LetterOfCredit',
        key: 'id'
      }
    },
    documentType: {
      type: DataTypes.ENUM('invoice', 'bill_of_lading', 'packing_list', 'certificate_of_origin', 'inspection_report', 'insurance_document', 'draft', 'amendment', 'other'),
      allowNull: false
    },
    documentNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: false
    },
    uploadedDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    uploadedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected', 'discrepancy_found'),
      defaultValue: 'pending'
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['letter_of_credit_id'] },
      { fields: ['document_type'] },
      { fields: ['status'] }
    ]
  });

  return LetterOfCreditDocument;
};
