const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductCategory = sequelize.define('ProductCategory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      // unique removed — sub-categories across different parents may share names
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    icon: {
      // Emoji or icon name (e.g. "🪵", "layers", "car")
      type: DataTypes.STRING,
      allowNull: true,
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'ProductCategories',
        key: 'id'
      }
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 99,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'ProductCategories',
    timestamps: true,
  });

  // Associations are defined in models/index.js to avoid duplicate alias errors.
  // ProductCategory <-> ProductCategory (self-referential) and ProductCategory <-> Product
  // are both wired there.

  return ProductCategory;
};
