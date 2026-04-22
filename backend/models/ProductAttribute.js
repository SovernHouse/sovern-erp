const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductAttribute = sequelize.define('ProductAttribute', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'ProductCategory', key: 'id' }
    },
    attributeName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    attributeType: {
      type: DataTypes.ENUM('text', 'number', 'decimal', 'select', 'boolean', 'multiselect', 'date', 'url'),
      defaultValue: 'text'
    },
    isRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    sequence: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    defaultValue: {
      type: DataTypes.STRING,
      allowNull: true
    },
    allowedValues: {
      type: DataTypes.JSON,
      defaultValue: null
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: true
    },
    minValue: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true
    },
    maxValue: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true
    },
    helpText: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'User', key: 'id' }
    }
  }, {
    indexes: [
      { fields: ['category_id'] },
      { fields: ['is_active'] },
      { fields: ['category_id', 'sequence'] }
    ]
  });

  ProductAttribute.associate = (models) => {
    ProductAttribute.belongsTo(models.ProductCategory, { foreignKey: 'categoryId' });
    ProductAttribute.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
  };

  return ProductAttribute;
};
