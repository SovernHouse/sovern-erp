const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HarmonizedCode = sequelize.define('HarmonizedCode', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    code: {
      type: DataTypes.STRING(12),
      allowNull: false,
      unique: true,
      validate: { len: [6, 12] }
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false
    },
    chapter: {
      type: DataTypes.STRING(2),
      allowNull: true
    },
    heading: {
      type: DataTypes.STRING(4),
      allowNull: true
    },
    subheading: {
      type: DataTypes.STRING(6),
      allowNull: true
    },
    dutyRate: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      comment: 'Default duty rate as percentage'
    },
    antiDumpingRate: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      comment: 'Default anti-dumping rate as percentage'
    },
    countrySpecific: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Country-specific duties: {"CN": {"dutyRate": 241, "antiDumpingRate": 305}}'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    indexes: [
      { fields: ['code'] },
      { fields: ['chapter'] },
      { fields: ['heading'] }
    ]
  });

  return HarmonizedCode;
};
