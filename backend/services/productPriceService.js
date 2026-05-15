/**
 * productPriceService — Phase 4.9.2b.
 *
 * Single source of truth for "what is the current price of this
 * product (at this origin) as of this date?". Used by:
 *   - quotationController.create + update (floor + line-item price)
 *   - quotation builder UIs via API responses (read path)
 *   - the afterSave reconcile job at boot
 *
 * Returned shape mirrors the ProductPrice row but with `effective`
 * fields resolved so callers don't have to handle the null sellingPrice
 * fallback themselves.
 */

const { Op } = require('sequelize');
const db = require('../models');
const logger = require('../utils/logger');

/**
 * Return the ProductPrice row that is currently in effect for the
 * given (productId, origin) as of `asOfDate` (defaults to today).
 *
 * If origin is supplied, prefers (productId, origin) match.
 * If no match for that origin, falls back to (productId, origin=null)
 * — the "open price" interpretation per the spec.
 *
 * Returns null when no active row exists.
 */
async function getCurrentPrice(productId, origin = null, asOfDate = null) {
  if (!productId) return null;
  const asOf = asOfDate || new Date().toISOString().slice(0, 10);

  // Helper: window-filter clause shared by both queries.
  const windowWhere = {
    productId,
    validFrom: { [Op.lte]: asOf },
    [Op.or]: [{ validTo: null }, { validTo: { [Op.gte]: asOf } }],
  };

  // Try the exact origin first.
  if (origin) {
    const hit = await db.ProductPrice.findOne({
      where: { ...windowWhere, origin },
      order: [['validFrom', 'DESC']],
    });
    if (hit) return resolveEffective(hit);
  }

  // Fallback: open price (origin=null).
  const open = await db.ProductPrice.findOne({
    where: { ...windowWhere, origin: null },
    order: [['validFrom', 'DESC']],
  });
  if (open) return resolveEffective(open);

  // Final fallback: any active row for this product. Useful when the
  // caller doesn't know the origin and just wants the most recent.
  if (origin) {
    const any = await db.ProductPrice.findOne({
      where: windowWhere,
      order: [['validFrom', 'DESC']],
    });
    if (any) return resolveEffective(any);
  }

  return null;
}

/**
 * Decorate a ProductPrice row with derived fields the caller usually
 * wants alongside the raw columns.
 */
function resolveEffective(row) {
  const cost = Number(row.costPriceUsdPerM2);
  const markup = row.markupPercent != null ? Number(row.markupPercent) : null;
  const selling = row.sellingPriceUsdPerM2 != null
    ? Number(row.sellingPriceUsdPerM2)
    : (markup != null ? cost * (1 + markup) : cost);
  const landed = row.tariffRate != null
    ? selling * (1 + Number(row.tariffRate))
    : null;
  const SQFT_PER_SQM = 10.7639104167097;
  return {
    id: row.id,
    productId: row.productId,
    factoryId: row.factoryId,
    origin: row.origin,
    costPriceUsdPerM2: cost,
    costPriceUsdPerSqft: cost / SQFT_PER_SQM,
    sellingPriceUsdPerM2: selling,
    sellingPriceUsdPerSqft: selling / SQFT_PER_SQM,
    markupPercent: markup,
    currency: row.currency || 'USD',
    tariffRate: row.tariffRate != null ? Number(row.tariffRate) : null,
    tariffDestination: row.tariffDestination,
    landedPriceUsdPerM2: landed,
    validFrom: row.validFrom,
    validTo: row.validTo,
    sourceNote: row.sourceNote,
    createdBy: row.createdBy,
    raw: row,
  };
}

/**
 * Reconcile job — for every Product, find the current active
 * ProductPrice row (for the product's preferred origin or open) and
 * make sure Product.baseFobPrice matches the resolved sellingPrice.
 *
 * Catches the case where someone edited ProductPrice directly via
 * SQL/admin and the afterSave hook didn't fire. Idempotent: only
 * touches rows that actually need updating.
 *
 * Runs at boot once and can be invoked manually by future ops scripts.
 */
async function reconcileBaseFobPrices() {
  if (!db?.Product || !db?.ProductPrice) return { skipped: true };
  const products = await db.Product.findAll({
    attributes: ['id', 'baseFobPrice', 'originCountry'],
  });
  let updated = 0;
  let unchanged = 0;
  let noPrice = 0;
  for (const p of products) {
    const cur = await getCurrentPrice(p.id, p.originCountry || null);
    if (!cur) { noPrice++; continue; }
    const target = Number(cur.sellingPriceUsdPerM2);
    const current = p.baseFobPrice != null ? Number(p.baseFobPrice) : null;
    if (current === target) { unchanged++; continue; }
    await p.update({ baseFobPrice: target });
    updated++;
  }
  logger.info(`[productPriceService.reconcile] updated=${updated} unchanged=${unchanged} noPrice=${noPrice}`);
  return { updated, unchanged, noPrice };
}

module.exports = { getCurrentPrice, resolveEffective, reconcileBaseFobPrices };
