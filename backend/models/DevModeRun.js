const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DevModeRun = sequelize.define('DevModeRun', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        'queued',
        'running',
        'opening_pr',
        'awaiting_clarification',
        'completed',
        'wip',
        'failed',
        'aborted'
      ),
      defaultValue: 'queued',
      allowNull: false,
    },
    branchName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    prUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    prNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    prMergedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    filesChanged: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    linesAdded: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    linesDeleted: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    turnCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    maxTurns: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
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
    workTreePath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subprocessPid: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    clarificationQuestion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    clarificationAnswer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    awaitingSince: {
      type: DataTypes.DATE,
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
    tableName: 'DevModeRuns',
    timestamps: true,
    indexes: [
      { fields: ['user_id', 'created_at'] },
      { fields: ['status'] },
    ],
  });

  DevModeRun.associate = (models) => {
    if (models.User) {
      DevModeRun.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'requester',
      });
    }
  };

  return DevModeRun;
};
