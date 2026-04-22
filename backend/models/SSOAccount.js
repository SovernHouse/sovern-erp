const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SSOAccount = sequelize.define('SSOAccount', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    provider: {
      type: DataTypes.ENUM('google', 'microsoft'),
      allowNull: false
    },
    providerId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    providerEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['user_id'] },
      { fields: ['provider'] },
      { unique: true, fields: ['user_id', 'provider'] }
    ]
  });

  SSOAccount.associate = (models) => {
    SSOAccount.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return SSOAccount;
};
