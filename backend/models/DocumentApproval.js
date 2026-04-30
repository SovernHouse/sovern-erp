const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const DocumentApproval = sequelize.define('DocumentApproval', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Which document this approval is for
    entityType: {
      type: DataTypes.ENUM('ProformaInvoice', 'Quotation', 'SalesOrder'),
      allowNull: false,
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    documentLabel: {
      type: DataTypes.STRING,
      allowNull: true, // e.g. "PI-20260430-XYZ" — stored for display without a JOIN
    },

    // Approval token — included in the link sent to the client
    token: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
      defaultValue: () => crypto.randomBytes(32).toString('hex'),
    },

    // Lifecycle
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired'),
      defaultValue: 'pending',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    // Who requested the approval (internal user)
    requestedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true, // Optional message shown to the client on the approval page
    },

    // Client response
    clientName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    clientEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Audit — IP and user-agent at time of response
    clientIp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    clientUserAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'DocumentApprovals',
    timestamps: true,
    indexes: [
      { fields: ['token'] },
      { fields: ['entityType', 'entityId'] },
      { fields: ['status'] },
    ],
  });

  DocumentApproval.associate = (models) => {
    DocumentApproval.belongsTo(models.User, {
      as: 'requestedBy',
      foreignKey: 'requestedByUserId',
    });
  };

  return DocumentApproval;
};
