const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ExchangeRate = sequelize.define('ExchangeRate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    baseCurrency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
      allowNull: false
    },
    targetCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false
    },
    rate: {
      type: DataTypes.DECIMAL(15, 6),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    source: {
      type: DataTypes.ENUM('manual', 'api'),
      defaultValue: 'manual'
    },
    effectiveDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    indexes: [
      { fields: ['base_currency', 'target_currency'] },
      { fields: ['effective_date'] },
      { fields: ['is_active'] },
      { fields: ['target_currency'] }
    ],
    uniqueKeys: {
      unique_rate_pair: {
        fields: ['base_currency', 'target_currency']
      }
    }
  });

  return ExchangeRate;
};
