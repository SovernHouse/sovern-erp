const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommissionTracking = sequelize.define('CommissionTracking', {
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
    commissionRuleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'CommissionRules',
        key: 'id'
      }
    },
    salesOrderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'SalesOrders',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Commission amount earned'
    },
    percentage: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      comment: 'Commission percentage applied'
    },
    orderAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Order total amount'
    },
    // Phase 4, C15: status enum widened to track the FW factory-payback
    // flow end-to-end. Legacy values (pending, paid, disputed) preserved.
    //   accrued              — newly-tracked; commission owed by factory
    //   invoiced_to_factory  — invoice sent to factory; awaiting payment
    //   paid                 — factory paid (existing)
    //   disputed             — factory contests; existing
    //   clawed_back          — refunded/canceled deal; commission reversed
    //   pending              — legacy default for rows seeded before C15
    // Migration in additiveMigrations remaps approved→accrued and
    // cancelled→clawed_back. New rows default to 'accrued'.
    status: {
      type: DataTypes.ENUM('pending', 'accrued', 'invoiced_to_factory', 'paid', 'disputed', 'clawed_back'),
      defaultValue: 'accrued'
    },
    paidDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Phase 4, C15: who the deal is for and which brand it belongs to.
    // brandCode required new rows; existing rows get backfilled to 'FW'
    // (the only brand that accrues commission today) by the migration.
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    brandCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'FW',
    },
    accrualDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the SO transitioned to confirmed and the commission was accrued.',
    },
    registeredBuyerSince: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Snapshot of when this customer became a registered buyer for this brand. Used by future tail-commission tracking.',
    }
  }, {
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'status'] },
      { fields: ['sales_order_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
      // Phase 4, C15
      { fields: ['customer_id'] },
      { fields: ['brand_code'] },
      { fields: ['brand_code', 'status'] },
      { fields: ['accrual_date'] },
    ]
  });

  // 2026-05-18 bugfix: declare Sequelize associations so the FW
  // commission dashboard's eager-load `include: [SalesOrder, Customer]`
  // doesn't throw "Customer is not associated to CommissionTracking!".
  // The FK columns exist (lines 27/75 above) but the JS-level relation
  // was never declared, so every commissions/dashboard GET 500'd.
  CommissionTracking.associate = (models) => {
    if (models.SalesOrder) {
      CommissionTracking.belongsTo(models.SalesOrder, { foreignKey: 'salesOrderId' });
    }
    if (models.Customer) {
      CommissionTracking.belongsTo(models.Customer, { foreignKey: 'customerId' });
    }
    if (models.User) {
      CommissionTracking.belongsTo(models.User, { foreignKey: 'userId' });
    }
    if (models.CommissionRule) {
      CommissionTracking.belongsTo(models.CommissionRule, { foreignKey: 'commissionRuleId' });
    }
  };

  return CommissionTracking;
};
