const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Document = sequelize.define('Document', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('template', 'generated', 'uploaded'),
      defaultValue: 'uploaded'
    },
    category: {
      type: DataTypes.ENUM('quotation', 'proforma_invoice', 'sales_order', 'purchase_order', 'invoice', 'packing_list', 'shipping', 'inspection', 'contract', 'other'),
      defaultValue: 'other'
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    mimeType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    templateData: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    customFields: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tags: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['type'] },
      { fields: ['category'] },
      { fields: ['entity_type', 'entity_id'] },
      { fields: ['created_by'] },
      { fields: ['is_active'] }
    ]
  });

  return Document;
};
