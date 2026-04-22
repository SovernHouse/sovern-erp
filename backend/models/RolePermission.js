const { DataTypes } = require('sequelize');

/**
 * RolePermission
 * Stores the permission set for each role. Overrides rbacConfig.js defaults
 * when present in the DB. Admin UI reads/writes this table.
 *
 * permissions: JSON array of permission strings, e.g. ['dashboard','orders',...]
 *              OR ['*'] for full access (admin only)
 */
module.exports = (sequelize) => {
  const RolePermission = sequelize.define('RolePermission', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // one config row per role
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false, // Human-readable name shown in UI
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    permissions: {
      type: DataTypes.TEXT, // stored as JSON string
      allowNull: false,
      defaultValue: '[]',
      get() {
        const raw = this.getDataValue('permissions');
        try { return JSON.parse(raw); } catch { return []; }
      },
      set(val) {
        this.setDataValue('permissions', JSON.stringify(val));
      },
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // system roles cannot be deleted
    },
    isCustom: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // custom roles created by admin
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 99,
    },
  }, {
    tableName: 'RolePermissions',
    timestamps: true,
  });

  return RolePermission;
};
