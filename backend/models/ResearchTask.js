const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ResearchTask = sequelize.define('ResearchTask', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // 'clients' = source new buyers, output drafts as Lead rows
    // 'suppliers' = source new factories, output drafts as Factory rows
    mode: {
      type: DataTypes.ENUM('clients', 'suppliers'),
      allowNull: false,
    },
    // Free-form research instruction from the user (the slash command body).
    brief: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // Chat conversation that started the run, so the runner can append the
    // result message back into chat history when it completes. Nullable —
    // a run can also be started directly via the API without a conversation.
    conversationId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled'
      ),
      defaultValue: 'queued',
      allowNull: false,
    },
    // AI-written narrative summary of what it found and what it didn't.
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Array of {type: 'lead'|'factory', draftId|null, companyName, country,
    // sourceUrl, evidence, dedupedAgainst|null}. draftId is null when the
    // finding was deduped against an existing row (in which case
    // dedupedAgainst points to it).
    findings: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    findingsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    draftsCreated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    duplicatesFound: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    tokenUsage: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    estimatedCostUsd: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    subprocessPid: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'ResearchTasks',
    timestamps: true,
    indexes: [
      { fields: ['user_id', 'created_at'] },
      { fields: ['status'] },
      { fields: ['mode'] },
    ],
  });

  ResearchTask.associate = (models) => {
    if (models.User) {
      ResearchTask.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'requester',
      });
    }
    if (models.AIConversation) {
      ResearchTask.belongsTo(models.AIConversation, {
        foreignKey: 'conversationId',
        as: 'conversation',
      });
    }
  };

  return ResearchTask;
};
