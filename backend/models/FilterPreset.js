const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FilterPreset = sequelize.define('FilterPreset', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Entity type (e.g., salesOrder, invoice, shipment)'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'User-friendly name for the preset'
    },
    filters: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: 'Filter conditions as JSON object'
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether preset can be shared with other users'
    },
    shareToken: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
      comment: 'Token for sharing preset via URL'
    }
  }, {
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'entity_type'] },
      { fields: ['share_token'] }
    ]
  });

  return FilterPreset;
};
