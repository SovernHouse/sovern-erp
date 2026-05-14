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
    },
    // Phase 3, C12: locked-after-sent timestamp. Set automatically by
    // quotationController.send when the first FW quotation tied to this
    // customer flips status='sent'. Super_admin can override via
    // POST /api/customers/:id/override-branding-mode-lock with a reason;
    // override clears this column and writes a product_branding_mode_override
    // audit row. Non-super_admin updates to productBrandingMode are
    // rejected with 403 while locked.
    productBrandingModeLockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    // Phase 4, C18: sanctions screening. screeningStatus drives the
    // hard-block at Lead/Customer/Quotation create and Outreach send.
    // 'override' is super-admin attestation — preserves the underlying
    // flag in sanctionsScreenDetails but unblocks downstream actions.
    screeningStatus: {
      type: DataTypes.ENUM('pending', 'cleared', 'flagged', 'requires_review', 'override'),
      allowNull: false,
      defaultValue: 'pending',
    },
    lastScreenedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // [{list, matchedName, country, score, reason}] — raw per L-023.
    sanctionsScreenDetails: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    sanctionBlockReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sanctionOverrideReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sanctionOverrideAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sanctionOverrideBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    registeredBuyerSince: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    registeredBuyer: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    paranoid: true, // soft deletes — sets deletedAt instead of hard-deleting
    indexes: [
      { fields: ['email'] },
      { fields: ['company_name'] },
      { fields: ['is_active'] },
      { fields: ['country'] },
      { fields: ['credit_hold'] },
      // Phase 4, C18: indexes for the 90d rescreen cron + sanctions-block scans.
      { fields: ['screening_status'] },
      { fields: ['last_screened_at'] },
    ]
  });

  return Customer;
};
