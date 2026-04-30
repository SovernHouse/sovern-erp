const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    factoryId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    unit: {
      type: DataTypes.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
      defaultValue: 'sqm'
    },
    specifications: {
      type: DataTypes.JSON,
      defaultValue: {
        thickness: null,
        width: null,
        length: null,
        material: null,
        finish: null,
        color: null,
        wearLayer: null,
        acRating: null,
        species: null,
        grade: null,
        construction: null,
        clickSystem: null
      }
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    minOrderQty: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1
    },
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    hsCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  }, {
    indexes: [
      { fields: ['name'] },
      { fields: ['sku'] },
      { fields: ['category_id'] },
      { fields: ['factory_id'] },
      { fields: ['is_active'] },
      { fields: ['deleted_at'] },
      { fields: ['created_at'] }
    ]
  });

  return Product;
};
