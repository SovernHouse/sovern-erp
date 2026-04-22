const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Webhook = sequelize.define('Webhook', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    url: {
      type: DataTypes.STRING(2048),
      allowNull: false,
      validate: {
        isUrl: true
      }
    },
    secret: {
      type: DataTypes.STRING(256),
      allowNull: true,
      comment: 'Secret key for HMAC-SHA256 signing of payloads'
    },
    events: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of subscribed event types'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      index: true
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
      index: true
    },
    factoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      index: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false
    },
    lastTriggered: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failureCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of consecutive delivery failures'
    },
    lastFailureReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total retry attempts made'
    }
  }, {
    indexes: [
      { fields: ['is_active'] },
      { fields: ['customer_id'] },
      { fields: ['factory_id'] },
      { fields: ['created_by'] },
      { fields: ['last_triggered'] }
    ],
    timestamps: true
  });

  Webhook.associate = (models) => {
    Webhook.belongsTo(models.User, { as: 'creator', foreignKey: 'createdBy' });
    Webhook.belongsTo(models.Customer, { as: 'customer', foreignKey: 'customerId' });
    Webhook.belongsTo(models.Factory, { as: 'factory', foreignKey: 'factoryId' });
    Webhook.hasMany(models.WebhookDelivery, { as: 'deliveries', foreignKey: 'webhookId', onDelete: 'CASCADE' });
  };

  return Webhook;
};
