const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NotificationPreference = sequelize.define('NotificationPreference', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    preferences: {
      type: DataTypes.JSON,
      defaultValue: {
        email: {
          orders: true,
          payments: true,
          shipments: true,
          claims: true,
          invoices: true,
          reports: false
        },
        inApp: {
          orders: true,
          payments: true,
          shipments: true,
          claims: true,
          invoices: true,
          reports: true
        },
        sms: {
          orders: false,
          payments: false,
          shipments: false,
          claims: false,
          invoices: false,
          reports: false
        }
      },
      allowNull: false,
      comment: 'Notification settings by channel and category'
    },
    digestFrequency: {
      type: DataTypes.ENUM('real-time', 'hourly', 'daily', 'weekly'),
      defaultValue: 'real-time',
      comment: 'How often to send digest notifications'
    },
    digestTime: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Preferred time for digest delivery (HH:MM:SS)'
    },
    unsubscribeToken: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
      comment: 'Token for one-click unsubscribe links'
    }
  }, {
    indexes: [
      { fields: ['user_id'] },
      { fields: ['unsubscribe_token'] }
    ]
  });

  return NotificationPreference;
};
