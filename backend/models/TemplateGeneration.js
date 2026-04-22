const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TemplateGeneration = sequelize.define('TemplateGeneration', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'DocumentTemplate', key: 'id' }
    },
    sourceEntityType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sourceEntityId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    generatedFileUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    generatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    generatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'User', key: 'id' }
    },
    fieldValues: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    status: {
      type: DataTypes.ENUM('pending', 'generated', 'failed'),
      defaultValue: 'pending'
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['template_id'] },
      { fields: ['source_entity_type', 'source_entity_id'] },
      { fields: ['generated_by'] },
      { fields: ['status'] }
    ]
  });

  TemplateGeneration.associate = (models) => {
    TemplateGeneration.belongsTo(models.DocumentTemplate, { foreignKey: 'templateId', as: 'template' });
    TemplateGeneration.belongsTo(models.User, { foreignKey: 'generatedBy', as: 'generator' });
  };

  return TemplateGeneration;
};
