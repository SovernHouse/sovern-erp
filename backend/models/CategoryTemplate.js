const { DataTypes } = require('sequelize');

/**
 * CategoryTemplate — stores named snapshots of a full ProductCategory hierarchy.
 * Used for seeding new whitelabel deployments and for resetting to known-good states.
 *
 * The `categories` field is a JSON array of:
 *   [{ name, slug, icon, description, sortOrder, children: [{ name, slug, icon, sortOrder }] }]
 */
module.exports = (sequelize) => {
  const CategoryTemplate = sequelize.define('CategoryTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isDefault: {
      // The default template is auto-loaded on fresh installs and shown first in the UI
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isSystem: {
      // System templates are read-only (cannot be deleted)
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    categories: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      get() {
        try { return JSON.parse(this.getDataValue('categories')); } catch { return []; }
      },
      set(val) {
        this.setDataValue('categories', JSON.stringify(val));
      },
    },
  }, {
    tableName: 'CategoryTemplates',
    timestamps: true,
  });

  return CategoryTemplate;
};
