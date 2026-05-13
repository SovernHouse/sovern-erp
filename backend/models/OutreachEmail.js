const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OutreachEmail = sequelize.define('OutreachEmail', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Leads',
        key: 'id',
      },
    },
    sentByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      // references removed — FK handled by Sequelize association (belongsTo User)
    },
    fromAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    toAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    toName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    bodyText: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    touchNumber: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.ENUM('queued', 'sent', 'failed', 'bounced'),
      defaultValue: 'sent',
    },
    smtpMessageId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    followUpDueAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    followUpCompleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    followUpNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    campaignId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Campaigns',
        key: 'id',
      },
    },
    errorMessage: {
      type: DataTypes.TEXT,
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
    // Multi-brand (Phase 1, D-1). FK to Brand.code in models/index.js.
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'SH',
    },
  }, {
    tableName: 'OutreachEmails',
    timestamps: true,
  });

  OutreachEmail.associate = (models) => {
    OutreachEmail.belongsTo(models.Lead, { foreignKey: 'leadId', as: 'lead' });
    OutreachEmail.belongsTo(models.User, { foreignKey: 'sentByUserId', as: 'sentBy' });
    OutreachEmail.belongsTo(models.Campaign, { foreignKey: 'campaignId', as: 'campaign' });
  };

  return OutreachEmail;
};
