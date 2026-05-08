const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ExpoPushToken = sequelize.define('ExpoPushToken', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    deviceId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    platform: {
      type: DataTypes.ENUM('ios', 'android', 'web'),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'ExpoPushTokens',
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['token'], unique: true },
    ],
  });

  ExpoPushToken.associate = (models) => {
    if (models.User) {
      ExpoPushToken.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  };

  return ExpoPushToken;
};
