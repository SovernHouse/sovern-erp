const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Deal = sequelize.define('Deal', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    dealNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Auto-generated: DL-YYYYMMDD-XXX',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Customers',
        key: 'id',
      },
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Contacts',
        key: 'id',
      },
    },
    assignedToId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
    stage: {
      type: DataTypes.ENUM('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'),
      defaultValue: 'prospecting',
    },
    value: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD',
    },
    probability: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
    },
    expectedCloseDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    actualCloseDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
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
    tableName: 'Deals',
    timestamps: true,
  });

  Deal.associate = (models) => {
    Deal.belongsTo(models.Customer, { foreignKey: 'customerId' });
    Deal.belongsTo(models.Contact, { foreignKey: 'contactId' });
    Deal.belongsTo(models.User, { foreignKey: 'assignedToId', as: 'assignedTo' });
  };

  return Deal;
};
