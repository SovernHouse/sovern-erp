const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Contact = sequelize.define('Contact', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
      // No DB-level FK constraint on purpose: Sequelize's
      // references-by-model-name resolver pluralizes the table name
      // (Customer -> Customers) even when freezeTableName: true is
      // set, which produces a FK pointing at a table that doesn't
      // exist on this DB. JS-level association lives in
      // models/index.js (Contact.belongsTo(Customer)) and is what
      // the controllers use, so dropping the DB FK is purely a
      // safety-versus-broken-behaviour trade. Empty Contacts table
      // verified pre-existing 2026-05-05.
    },
    factoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      // See customerId comment — same trade.
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mobile: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    jobTitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    department: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    birthday: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    linkedinUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'Contacts',
    timestamps: true,
  });

  Contact.associate = (models) => {
    Contact.belongsTo(models.Customer, { foreignKey: 'customerId' });
    Contact.belongsTo(models.Factory, { foreignKey: 'factoryId' });
  };

  return Contact;
};
