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
    },
    // Phase 4.5 C21 follow-up: archived (hidden from default UI but
    // restorable) vs isActive (legacy soft-delete). Distinct concepts;
    // an archived row can still be `isActive=true` historically.
    // Default false so newly-created rows show up; the boot-time
    // migrateArchiveTaxonomyC21Followup flips this for the 5 non-
    // flooring parents + their children on first deploy.
    isArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  }, {
    tableName: 'ProductCategories',
    timestamps: true,
  });

  // Associations are defined in models/index.js to avoid duplicate alias errors.
  // ProductCategory <-> ProductCategory (self-referential) and ProductCategory <-> Product
  // are both wired there.

  return ProductCategory;
};
