const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PriceList = sequelize.define('PriceList', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    currencyCode: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    validFrom: {
      type: DataTypes.DATE,
      allowNull: true
    },
    validTo: {
      type: DataTypes.DATE,
      allowNull: true
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Customer', key: 'id' }
    },
    factoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Factory', key: 'id' }
    },
    columnDefinitions: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'User', key: 'id' }
    }
  }, {
    indexes: [
      { fields: ['customer_id'] },
      { fields: ['factory_id'] },
      { fields: ['is_active'] },
      { fields: ['valid_from', 'valid_to'] }
    ]
  });

  PriceList.associate = (models) => {
    PriceList.belongsTo(models.Customer, { foreignKey: 'customerId' });
    PriceList.belongsTo(models.Factory, { foreignKey: 'factoryId' });
    PriceList.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    PriceList.hasMany(models.PriceListItem, { foreignKey: 'priceListId', as: 'items' });
  };

  return PriceList;
};
