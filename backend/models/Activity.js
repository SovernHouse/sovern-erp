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
    contactId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Contacts',
        key: 'id',
      },
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Customers',
        key: 'id',
      },
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Leads',
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
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
