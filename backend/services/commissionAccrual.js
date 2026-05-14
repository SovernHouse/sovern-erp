/**
 * Commission accrual (Phase 3, C11).
 *
 * Auto-creates a CommissionTracking row when a SalesOrder is created
 * under a brand that has an active percentage rule. Today only FW has
 * a seeded commission rule (5% default; see seedCommissionRules.js),
 * but the helper is brand-agnostic — any future brand that gets a
 * "<BRAND> Sales Commission" rule will accrue automatically.
 *
 * Rule lookup is by NAME convention: `{brand.displayName} Sales Commission`.
 * If you change the seed name, change this lookup too — or replace the
 * lookup with a Brand.commissionRuleId column (Phase 4+).
 *
 * The percentage on each tracking row defaults to rule.baseValue but is
 * **editable per order** via PATCH /api/personalization/commissions/:id
 * (super_admin or the row owner). The recalculated amount is stored on
 * the row so reports don't have to re-multiply.
 *
 * Fire-and-forget: failures are logged but never block SO creation.
 * Commission is a downstream concern; a missing accrual can be patched
 * in by super_admin without losing the order.
 */

const logger = require('../utils/logger');

/**
 * Create a CommissionTracking row if the SO's brand has an active rule.
 *
 * @param {object} db             Sequelize db handle (from `require('../models')`).
 * @param {object} so             SalesOrder instance (must have brandCode, total).
 * @param {string} userId         User to credit the commission to (usually req.user.id).
 * @param {object} [opts]
 * @param {object} [opts.transaction]  Sequelize transaction handle.
 * @returns {Promise<object|null>}   The CommissionTracking row, or null.
 */
async function accrueCommissionForOrder(db, so, userId, opts = {}) {
  if (!db || !so || !userId) return null;

  const brandCode = so.brandCode;
  if (!brandCode) return null;

  try {
    const brand = await db.Brand.findOne({ where: { code: brandCode } });
    if (!brand) return null;

    const rule = await db.CommissionRule.findOne({
      where: {
        name: `${brand.displayName} Sales Commission`,
        isActive: true,
      },
    });
    if (!rule) return null;

    // Idempotency guard: don't double-accrue if a row already exists for
    // this (userId, salesOrderId) pair. This protects against re-runs of
    // a retried route handler.
    const existing = await db.CommissionTracking.findOne({
      where: { userId, salesOrderId: so.id },
    });
    if (existing) return existing;

    const orderAmount = parseFloat(so.total || 0);
    const percentage = parseFloat(rule.baseValue || 0);
    const amount = +(orderAmount * percentage / 100).toFixed(2);

    const tx = opts.transaction;
    const row = await db.CommissionTracking.create(
      {
        userId,
        commissionRuleId: rule.id,
        salesOrderId: so.id,
        orderAmount,
        percentage,
        amount,
        status: 'pending',
        notes: `Auto-accrued from rule "${rule.name}" at SalesOrder creation`,
      },
      tx ? { transaction: tx } : undefined
    );
    return row;
  } catch (err) {
    logger.error('[commissionAccrual] Failed to accrue for SO', so?.id, err.message);
    return null;
  }
}

/**
 * Recalculate amount when the per-order percentage is changed. Used by
 * the PATCH endpoint. Mutates the row's `percentage` and `amount` and
 * persists.
 */
async function updateCommissionPercentage(row, newPercentagePct) {
  const pct = parseFloat(newPercentagePct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error('percentage must be between 0 and 100');
  }
  const orderAmount = parseFloat(row.orderAmount || 0);
  const newAmount = +(orderAmount * pct / 100).toFixed(2);
  await row.update({ percentage: pct, amount: newAmount });
  return row;
}

module.exports = { accrueCommissionForOrder, updateCommissionPercentage };
