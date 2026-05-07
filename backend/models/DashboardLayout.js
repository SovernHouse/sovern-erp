const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DashboardLayout = sequelize.define('DashboardLayout', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
      // FK to User declared in associate(), not inline. Inline references:
      // { model: 'Users' } breaks because freezeTableName makes the actual
      // table 'User' (singular). See L-034 in repo CLAUDE.md.
    },
    role: {
      type: DataTypes.ENUM('admin', 'sales', 'operations', 'finance', 'inspector', 'customer', 'factory'),
      allowNull: false
    },
    layout: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: false,
      comment: 'Array of widget configurations with position and size'
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this is the default layout for the role'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Optional name for saved layouts'
    }
  }, {
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'role'] },
      { fields: ['role', 'is_default'] }
    ]
  });

  DashboardLayout.associate = (models) => {
    DashboardLayout.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return DashboardLayout;
};
