const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ConnectedGoogleAccount = sequelize.define('ConnectedGoogleAccount', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Google account email (e.g. alex@sovernhouse.co)
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // OAuth tokens — stored as-is; rotate via refresh token before expiry
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Scopes granted during OAuth consent
    // Stored as JSON array: ["gmail.modify", "calendar", "drive.readonly", ...]
    scopes: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue('scopes');
        try { return raw ? JSON.parse(raw) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('scopes', Array.isArray(val) ? JSON.stringify(val) : val);
      },
    },
    // Gmail incremental sync cursor — opaque historyId from Gmail API
    gmailHistoryId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastGmailSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Google Calendar incremental sync token
    calendarSyncToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastCalendarSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Whether this account should be polled by the background sync jobs
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Which ERP user connected this account
    connectedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'ConnectedGoogleAccounts',
    underscored: true,
    timestamps: true,
  });

  ConnectedGoogleAccount.associate = (models) => {
    if (models.User) {
      ConnectedGoogleAccount.belongsTo(models.User, {
        foreignKey: 'connectedByUserId',
        as: 'connectedBy',
      });
    }
  };

  return ConnectedGoogleAccount;
};
