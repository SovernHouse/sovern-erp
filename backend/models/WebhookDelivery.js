const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WebhookDelivery = sequelize.define('WebhookDelivery', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    webhookId: {
      type: DataTypes.UUID,
      allowNull: false,
      index: true
    },
    event: {
      type: DataTypes.STRING(255),
      allowNull: false,
      index: true,
      comment: 'Event type that triggered this delivery'
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: 'Event payload sent to webhook'
    },
    statusCode: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'HTTP response status code'
    },
    responseBody: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Response body from webhook endpoint'
    },
    isSuccess: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      index: true
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error message if delivery failed'
    },
    attemptNumber: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: 'Retry attempt number'
    },
    nextRetryAt: {
      type: DataTypes.DATE,
      allowNull: true,
      index: true,
      comment: 'Scheduled time for next retry'
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    processingTimeMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Time taken to deliver in milliseconds'
    }
  }, {
    indexes: [
      { fields: ['webhook_id', 'is_success'] },
      { fields: ['event'] },
      { fields: ['delivered_at'] },
      { fields: ['next_retry_at'] }
    ],
    timestamps: true
  });

  WebhookDelivery.associate = (models) => {
    WebhookDelivery.belongsTo(models.Webhook, { foreignKey: 'webhookId' });
  };

  return WebhookDelivery;
};
