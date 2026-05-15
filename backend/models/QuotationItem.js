const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuotationItem = sequelize.define('QuotationItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    quotationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Quotation',
        key: 'id'
      }
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Product',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    unit: {
      type: DataTypes.ENUM('sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'),
      defaultValue: 'sqm'
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    discount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // ── Phase 4.9 C-3: multi-origin + landed-cost ─────────────────────────
    // originCountry is the ISO2 of the producing country (e.g. 'CN', 'MY').
    // Resolved from the chosen Product.originVariants entry at create/update
    // time. Persisted on the row so PDF re-render and the audit trail can
    // see which origin the buyer was quoted.
    originCountry: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    // FOB price the buyer was quoted, in USD per the line's `unit`. This is
    // the canonical line price BEFORE the tariff is layered on. May differ
    // from unitPrice when below-floor overrides are used.
    fobPriceUsd: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    // Frozen tariff snapshot, written by quotationController.send() when
    // the destination is the US (or any tariff-tracked destination). Shape:
    //   { ratePercent: 40.7714, effectiveUntil: '2026-05-15',
    //     sourceTariffRateId: '<uuid>', sourceNote: '...' }
    // Reads only at PDF render and at history audits. Never recomputed; if
    // the live rate changes after send, the quotation stays at its snapshot.
    tariffSnapshot: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    landedCostUnit: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    landedCostTotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
  });

  return QuotationItem;
};
