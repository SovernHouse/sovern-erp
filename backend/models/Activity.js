const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Activity = sequelize.define('Activity', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('call', 'email', 'meeting', 'note', 'task', 'follow_up'),
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // FK references intentionally omitted — relationships are declared via
    // Sequelize associations below. Inline `references:` blocks were causing
    // INSERTs to fail because SQLite resolves the referenced table name at
    // statement time, and freezeTableName: true means the actual tables are
    // singular (`User`, `Customer`) rather than the pluralized names this
    // file previously used. See Lead.js for the same pattern.
    contactId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration in minutes',
    },
    outcome: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium',
    },
    reminder: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'Activities',
    timestamps: true,
  });

  Activity.associate = (models) => {
    Activity.belongsTo(models.Contact, { foreignKey: 'contactId' });
    Activity.belongsTo(models.Customer, { foreignKey: 'customerId' });
    Activity.belongsTo(models.Lead, { foreignKey: 'leadId' });
    Activity.belongsTo(models.User, { foreignKey: 'userId', as: 'assignedUser' });
  };

  return Activity;
};
