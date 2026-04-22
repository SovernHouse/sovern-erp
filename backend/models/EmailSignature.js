const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmailSignature = sequelize.define('EmailSignature', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false, // Internal label e.g. "Alex — Founder"
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false, // e.g. "Alexander McConnell"
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true, // e.g. "Founder"
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true, // e.g. "sovernhouse.co"
    },
    signatureImageUrl: {
      type: DataTypes.STRING,
      allowNull: true, // handwritten signature image
    },
    logoUrl: {
      type: DataTypes.STRING,
      allowNull: true, // company logo
    },
    tagline: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    legalText: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'EmailSignatures',
    timestamps: true,
  });

  EmailSignature.associate = (models) => {
    EmailSignature.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return EmailSignature;
};
