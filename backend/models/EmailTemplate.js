const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmailTemplate = sequelize.define('EmailTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    bodyText: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true, // e.g. 'auto_parts', 'flooring', 'accessories'
    },
    createdByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'EmailTemplates',
    timestamps: true,
  });

  EmailTemplate.associate = (models) => {
    EmailTemplate.belongsTo(models.User, {
      foreignKey: 'createdByUserId',
      as: 'createdBy',
    });
  };

  return EmailTemplate;
};
