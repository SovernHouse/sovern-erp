const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Customer = sequelize.define('Customer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    contactPerson: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    paymentTerms: {
      type: DataTypes.STRING,
      defaultValue: 'Net 30'
    },
    creditLimit: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    rating: {
      type: DataTypes.FLOAT,
      defaultValue: 5.0,
      validate: {
        min: 0,
        max: 5
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    logo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    creditUsed: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    creditHold: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    creditHoldReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Multi-brand (Phase 1, D-6). Customer is a company-level identity that
    // may transact under multiple brands. Stored as JSON array of brand codes,
    // raw per L-023 (no JSON.stringify). Examples: ['SH'], ['SH','FW'].
    // Adding a code happens automatically when a new Lead/Quote is opened
    // against the customer under a brand not yet in the list. Removing is a
    // super_admin operation that writes to AuditLog.
    brandRelationships: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: ['SH'],
    },
    // FW-specific product-branding mode. Captured on the Customer record so
    // it's portable across all FW deals/quotes for that buyer. P1 schema only;
    // P3 wires composer + quotation template logic.
    //   'ironlite'       — sell as IronLite-branded (FW's flagship)
    //   'generic'        — sell as generic FlorWay (no sub-brand badge)
    //   'private_label'  — buyer's own brand name on packaging + docs
    productBrandingMode: {
      type: DataTypes.ENUM('ironlite', 'generic', 'private_label'),
      allowNull: true,
      defaultValue: null,
    },
    // Free-text brand name for private_label mode (e.g. "OakCove Flooring").
    // Only consulted when productBrandingMode = 'private_label'.
    privateLabelProductName: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  }, {
    paranoid: true, // soft deletes — sets deletedAt instead of hard-deleting
    indexes: [
      { fields: ['email'] },
      { fields: ['company_name'] },
      { fields: ['is_active'] },
      { fields: ['country'] },
      { fields: ['credit_hold'] }
    ]
  });

  return Customer;
};
