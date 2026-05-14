/**
 * Commission accrual (Phase 3, C11 + Phase 4, C15).
 *
 * Auto-creates a CommissionTracking row when a SalesOrder transitions
 * to status='confirmed'. Today only FW accrues (Brand.commissionRate
 * = 0.05 FW, 0.00 SH); helper is brand-agnostic and any future brand
 * with `commissionRate > 0` will accrue automatically.
 *
 * Rate resolution order (highest priority first):
 *   1. quotation.commissionRateOverride — set per-quote at create time
 *      (validated >= 0.05 server-side). Pulled via SO.quotationId chain.
 *   2. brand.commissionRate — Phase 4 authoritative source.
 *   3. Legacy CommissionRule.baseValue / 100 — fallback for any rows
 *      written before the Phase 4 path landed.
 *
 * Status conventions:
 *   - New rows default to 'accrued' (Phase 4 C15).
 *   - 'pending' rows exist from C11 era and are still readable.
 *   - 'invoiced_to_factory' / 'paid' / 'disputed' / 'clawed_back' are
 *     end-state transitions managed via dedicated endpoints.
 *
 * Idempotency: if a row already exists for (userId, salesOrderId) we
 * return it as-is. The status-transition hook can fire multiple times;
 * accrual happens once.
 *
 * Fire-and-forget at the call site. Failures log + return null; never
 * block SO creation or status change.
 *
 * Floor: COMMISSION_FLOOR_DECIMAL (0.05) cannot be overridden in any
 * code path. Quotation override validation, brand admin save, and
 * PATCH percentage edit all enforce.
 *
 * Stored `percentage` is the PERCENTAGE form (5.0 not 0.05) for
 * backward-compatibility with the C11 dashboard math. Decimal rate
 * is converted at write time.
 */

const logger = require('../utils/logger');

const COMMISSION_FLOOR_DECIMAL = 0.05;
const COMMISSION_FLOOR_PERCENT = 5.0;

/**
 * Resolve the commission rate (as decimal) for an SO. Tries override
 * via the source quotation first, then brand default, then legacy rule.
 * Returns null if no source produces a rate.
 */
async function resolveCommissionRateDecimal(db, so, brand) {
  // 1. Quotation override — SO may reference a source Quotation through
  //    the conversion chain. proformaInvoiceId → ProformaInvoice.quotationId
  //    OR an "accepted" Quotation may have been used to create the SO
  //    directly via /sales-orders/create-from-quotation. Try both paths.
  try {
    let quotation = null;
    if (so.proformaInvoiceId) {
      const pi = await db.ProformaInvoice.findByPk(so.proformaInvoiceId);
      if (pi?.quotationId) {
        quotation = await db.Quotation.findByPk(pi.quotationId);
      }
    }
    if (!quotation) {
      // Direct conversion: heuristic — match by customerId + brand + most
      // recent accepted quotation that doesn't already have an SO.
      // Best-effort; if it misses we fall through to brand default.
      const candidate = await db.Quotation.findOne({
        where: {
          customerId: so.customerId,
          brandCode: so.brandCode,
          status: 'accepted',
        },
        order: [['updatedAt', 'DESC']],
      });
      if (candidate?.commissionRateOverride != null) quotation = candidate;
    }
    if (quotation?.commissionRateOverride != null) {
      const rate = parseFloat(quotation.commissionRateOverride);
      if (Number.isFinite(rate) && rate >= COMMISSION_FLOOR_DECIMAL) return rate;
    }
  } catch (_) { /* ignore */ }

  // 2. Brand default.
  if (brand?.commissionRate != null) {
    const rate = parseFloat(brand.commissionRate);
    if (Number.isFinite(rate) && rate > 0) return rate;
  }

  // 3. Legacy CommissionRule fallback. `baseValue` is stored as percentage
  //    (5.0 not 0.05) — convert to decimal.
  try {
    const rule = await db.CommissionRule.findOne({
      where: { name: `${brand?.displayName || ''} Sales Commission`, isActive: true },
    });
    if (rule?.baseValue != null) {
      const pct = parseFloat(rule.baseValue);
      if (Number.isFinite(pct) && pct > 0) return pct / 100;
    }
  } catch (_) { /* ignore */ }

  return null;
}

/**
 * Phase 4, C15 entry point. Accrues only when SO is at status='confirmed'.
 * Calls from the legacy POST / and POST /create-from-quotation routes
 * (where SOs are born confirmed) plus the PATCH /:id/status hook for
 * draft→confirmed transitions.
 *
 * @param {object} db             Sequelize db handle.
 * @param {object} so             SalesOrder instance (with brandCode, total, customerId, status).
 * @param {string} userId         User to credit the commission to.
 * @param {object} [opts]
 * @param {object} [opts.transaction]  Sequelize transaction.
 * @returns {Promise<object|null>}     The CommissionTracking row, or null.
 */
async function accrueIfConfirmed(db, so, userId, opts = {}) {
  if (!db || !so || !userId) return null;
  if (so.status !== 'confirmed') return null;
  if (!so.brandCode) return null;

  try {
    const brand = await db.Brand.findOne({ where: { code: so.brandCode } });
    if (!brand) return null;

    const rateDecimal = await resolveCommissionRateDecimal(db, so, brand);
    if (rateDecimal == null || rateDecimal <= 0) return null;

    // Idempotency guard: don't double-accrue.
    const existing = await db.CommissionTracking.findOne({
      where: { userId, salesOrderId: so.id },
    });
    if (existing) return existing;

    // For the rule FK we keep the legacy CommissionRule reference when
    // available. New brand-driven accruals can use the FW rule as a
    // proxy or NULL. Lookup tolerates absence.
    const legacyRule = await db.CommissionRule.findOne({
      where: { name: `${brand.displayName} Sales Commission`, isActive: true },
    });

    const orderAmount = parseFloat(so.total || 0);
    const percentagePct = +(rateDecimal * 100).toFixed(4);
    const amount = +(orderAmount * rateDecimal).toFixed(2);

    // Registered-buyer snapshot: first time this (customerId, brandCode)
    // saw a confirmed SO. Captured at accrual time and frozen on the row.
    let registeredBuyerSince = null;
    try {
      const first = await db.SalesOrder.min('createdAt', {
        where: { customerId: so.customerId, brandCode: so.brandCode, status: 'confirmed' },
      });
      if (first) registeredBuyerSince = first;
    } catch (_) { /* ignore */ }

    const tx = opts.transaction;
    const row = await db.CommissionTracking.create(
      {
        userId,
        commissionRuleId: legacyRule?.id || null,
        salesOrderId: so.id,
        customerId: so.customerId || null,
        brandCode: so.brandCode,
        accrualDate: new Date(),
        registeredBuyerSince,
        orderAmount,
        percentage: percentagePct,
        amount,
        status: 'accrued',
        notes: `Auto-accrued at SO confirm; rate ${(rateDecimal * 100).toFixed(2)}% from ${
          legacyRule ? 'rule fallback' : 'brand.commissionRate / override'
        }`,
      },
      tx ? { transaction: tx } : undefined
    );
    return row;
  } catch (err) {
    logger.error('[commissionAccrual] Failed for SO', so?.id, err.message);
    return null;
  }
}

/**
 * Backwards-compat alias for the C11 entry point. Callers in
 * salesOrderRoutes.js use this name; preserved so we don't churn the
 * route file. Delegates to accrueIfConfirmed.
 */
async function accrueCommissionForOrder(db, so, userId, opts = {}) {
  return accrueIfConfirmed(db, so, userId, opts);
}

/**
 * Recalculate amount when the per-order percentage is changed.
 * Phase 4, C15: enforces the 5% floor (cannot be overridden) — different
 * from the product-price floor which has a super-admin override.
 */
async function updateCommissionPercentage(row, newPercentagePct) {
  const pct = parseFloat(newPercentagePct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error('percentage must be between 0 and 100');
  }
  if (pct < COMMISSION_FLOOR_PERCENT) {
    throw new Error(`Commission rate floor is ${COMMISSION_FLOOR_PERCENT}%; cannot go below`);
  }
  const orderAmount = parseFloat(row.orderAmount || 0);
  const newAmount = +(orderAmount * pct / 100).toFixed(2);
  await row.update({ percentage: pct, amount: newAmount });
  return row;
}

module.exports = {
  accrueIfConfirmed,
  accrueCommissionForOrder,    // C11 alias
  updateCommissionPercentage,
  resolveCommissionRateDecimal,
  COMMISSION_FLOOR_DECIMAL,
  COMMISSION_FLOOR_PERCENT,
};
