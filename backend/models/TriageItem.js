const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TriageItem = sequelize.define('TriageItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Gmail message ID — prevents duplicate processing on re-poll
    gmailMessageId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    // SMTP In-Reply-To header value — used to detect replies to outreach
    inReplyToMessageId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Whether this email was a reply to one of our outreach emails (Q3)
    isReplyToOutreach: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // The OutreachEmail record this is a reply to (if detected)
    matchedOutreachEmailId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // AI-extracted fields
    senderName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    senderCompany: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    senderEmail: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    productInterest: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    intentScore: {
      type: DataTypes.ENUM('high', 'medium', 'low', 'spam'),
      allowNull: true,
    },
    suggestedAction: {
      type: DataTypes.ENUM('create_lead', 'request_info', 'forward_fanzey', 'mark_spam', 'dismiss'),
      allowNull: true,
    },
    detectedLanguage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Original email data
    subject: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bodySnippet: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rawEmailData: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    // Lifecycle status
    status: {
      type: DataTypes.ENUM('pending', 'promoted', 'forwarded', 'spam', 'dismissed', 'archived'),
      defaultValue: 'pending',
    },
    // Auto-archive 7 days after creation (Q7-A)
    autoArchiveAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // Action tracking
    forwardedToFanzeyAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // The Lead created when this item was promoted (Q7-B)
    promotedLeadId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // Sync-now flag: set by the frontend, cleared by the Cowork task after running (Q4)
    syncRequestedAt: {
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
    // Multi-brand (Phase 1, D-1). Inbound emails — at triage time the user
    // tags the brand the message relates to. FK to Brand.code in index.js.
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'SH',
    },
  }, {
    tableName: 'TriageItems',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['gmail_message_id'], unique: true },
      { fields: ['sender_email'] },
      { fields: ['auto_archive_at'] },
      { fields: ['intent_score'] },
    ],
  });

  TriageItem.associate = (models) => {
    if (models.OutreachEmail) {
      TriageItem.belongsTo(models.OutreachEmail, {
        foreignKey: 'matchedOutreachEmailId',
        as: 'matchedOutreachEmail',
      });
    }
    if (models.Lead) {
      TriageItem.belongsTo(models.Lead, {
        foreignKey: 'promotedLeadId',
        as: 'promotedLead',
      });
    }
  };

  return TriageItem;
};
