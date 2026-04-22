const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DocumentTemplate = sequelize.define('DocumentTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    documentType: {
      type: DataTypes.ENUM(
        'sales_order', 'purchase_order', 'invoice', 'proforma_invoice',
        'packing_list', 'shipping_label', 'certificate_of_origin',
        'credit_note', 'quotation', 'delivery_note', 'custom'
      ),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fileType: {
      type: DataTypes.ENUM('pdf', 'docx', 'xlsx', 'html'),
      allowNull: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'User', key: 'id' }
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    templateFields: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    placeholderMappings: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    headerHtml: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    bodyHtml: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    footerHtml: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    customCss: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    companyInfo: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    pageSettings: {
      type: DataTypes.JSON,
      defaultValue: { size: 'A4', orientation: 'portrait', margins: { top: 20, right: 20, bottom: 20, left: 20 } }
    },
    versionNumber: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    parentTemplateId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['document_type'] },
      { fields: ['is_active'] },
      { fields: ['created_by'] },
      { fields: ['document_type', 'is_default'] }
    ]
  });

  DocumentTemplate.associate = (models) => {
    DocumentTemplate.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
  };

  return DocumentTemplate;
};
