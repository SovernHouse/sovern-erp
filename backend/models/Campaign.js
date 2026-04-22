const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Campaign = sequelize.define('Campaign', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('email', 'trade_show', 'advertisement', 'social_media', 'referral', 'other'),
      defaultValue: 'other',
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'paused', 'completed', 'cancelled'),
      defaultValue: 'draft',
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    budget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    actualCost: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    expectedRevenue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    actualRevenue: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    targetAudience: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    leadsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    conversionsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // ─── Bulk email send fields ───────────────────────────────────────────────
    subjectTemplate: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bodyTemplate: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fromAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    replyToAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sendStatus: {
      type: DataTypes.ENUM('idle', 'sending', 'completed', 'failed'),
      defaultValue: 'idle',
    },
    totalRecipients: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    sentCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    failedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastSentAt: {
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
    tableName: 'Campaigns',
    timestamps: true,
  });

  Campaign.associate = (models) => {
    Campaign.hasMany(models.OutreachEmail, { foreignKey: 'campaignId', as: 'outreachEmails' });
  };

  return Campaign;
};
