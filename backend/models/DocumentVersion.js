const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DocumentVersion = sequelize.define('DocumentVersion', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    documentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Document',
        key: 'id'
      }
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Version number (auto-increment per document)'
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Relative path to file storage'
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'File size in bytes'
    },
    uploadedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    changeNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notes about what changed in this version'
    },
    isCurrent: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Is this the current active version'
    }
  }, {
    timestamps: true,
    underscored: true,
    tableName: 'document_versions',
    indexes: [
      {
        fields: ['document_id']
      },
      {
        fields: ['document_id', 'version'],
        unique: true
      }
    ]
  });

  DocumentVersion.associate = (models) => {
    DocumentVersion.belongsTo(models.Document, {
      as: 'document',
      foreignKey: 'documentId'
    });

    DocumentVersion.belongsTo(models.User, {
      as: 'uploader',
      foreignKey: 'uploadedBy'
    });
  };

  return DocumentVersion;
};
