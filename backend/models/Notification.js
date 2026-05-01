const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('inquiry', 'quotation', 'order', 'shipment', 'inspection', 'claim', 'payment', 'system', 'triage'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    data: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    link: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['user_id'] },
      { fields: ['is_read'] }
    ]
  });

  return Notification;
};
