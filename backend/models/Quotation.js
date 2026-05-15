const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Quotation = sequelize.define('Quotation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    quotationNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    inquiryId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    salesPersonId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    // Sourcing trail: which factory the quote was sourced from (the
    // primary factory; per-line factories live on Product.factoryId).
    // Carries forward into ProformaInvoice / SalesOrder / Invoice via
    // the quotationId chain so internal users can trace 'where did
    // this price come from' end-to-end.
    factoryId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    // The Lead this quote was raised against, for quotes that come
    // out of an outbound prospect cycle before a Customer record
    // exists. Null once the lead has been converted (Customer is the
    // authoritative link from then on).
    leadId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'revised', 'accepted', 'rejected', 'expired'),
      defaultValue: 'draft'
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    discountType: {
      type: DataTypes.ENUM('percentage', 'fixed'),
      defaultValue: 'fixed'
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    validUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    terms: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    parentQuotationId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    // Client e-signature audit trail. Populated when the customer
    // accepts the quotation via /api/approvals/public/:token/approve
    // (which also flips status -> 'accepted'). IP/UA are stored on the
    // DocumentApproval row.
    signedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    signedByClient: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Multi-brand (Phase 1, D-1). FK to Brand.code in models/index.js.
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'SH',
    },
    // Phase 4, C15: per-quotation override of the brand-default commission
    // rate. Decimal 0..1 (e.g. 0.07 = 7%). NULL = use Brand.commissionRate.
    // Enforced server-side to be >= 0.0500 (5% floor locked 2026-05-14
    // for FW; SH commission is 0 by default so the override is effectively
    // unused there). Stored to surface "Your commission rate: X%" on the
    // quotation detail UI and to feed the accrual on SO confirmation.
    commissionRateOverride: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
      defaultValue: null,
    },
    // ── Phase 4.9 C-3: unit-display preference, locked on send ─────────
    // Quotation is edited and rendered in these units. Storage on
    // Product/QuotationItem stays canonical (sqm + mm). Conversion
    // happens at the form layer and at PDF render. Once the quotation
    // status flips to 'sent' the controller's draft-only guard prevents
    // further mutation, freezing these for the lifetime of the document.
    displayAreaUnit: {
      type: DataTypes.ENUM('sqm', 'sqft'),
      allowNull: false,
      defaultValue: 'sqm',
    },
    displayDimensionUnit: {
      type: DataTypes.ENUM('mm', 'inch'),
      allowNull: false,
      defaultValue: 'mm',
    },
  }, {
    indexes: [
      { fields: ['quotation_number'] },
      { fields: ['status'] },
      { fields: ['customer_id'] },
      { fields: ['inquiry_id'] },
      { fields: ['factory_id'] },
      { fields: ['lead_id'] },
      { fields: ['deleted_at'] },
      // Phase 4, C15: brand+status forecast filter
      { fields: ['status', 'brand_code'] },
    ]
  });

  return Quotation;
};
