/**
 * Phase 4.28g — zero the markup_percent on FW/HH ProductPrice rows.
 *
 * Follow-up to 4.28f. The 2026-05-19 incident traced the +7% inflation
 * on the IronLite Core price lists. Phase 4.28f fixed Product.
 * originVariants and archived the bad PriceLists, but did NOT touch
 * the parallel ProductPrice table that drives Product.baseFobPrice via
 * the reconcile job in productPriceService.reconcileBaseFobPrices.
 *
 * Each of the 9 IL- SKUs has two ProductPrice rows (origin=China and
 * origin=Malaysia) with cost_price_usd_per_m2 = the supplier sheet's
 * buyer-ready FOB and markup_percent = 0.07. The reconcile resolves
 * sellingPrice = cost * (1 + 0.07) = cost * 1.07 and overwrites
 * baseFobPrice. That is the second layer of the bug.
 *
 * For FW and HH Products, supplier FOB IS the buyer price. markup_percent
 * must be 0. selling_price_usd_per_m2 set explicitly to cost_price_usd
 * _per_m2 so the resolver returns the supplier value verbatim regardless
 * of any future tooling that nulls markup_percent.
 *
 * Scope: every active ProductPrice row whose joined Product has
 * brand_code in {'FW', 'HH'}. Idempotent via AuditLog sentinel
 * `phase4_28g_product_price_markup_zero_fw_hh`.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_28g_product_price_markup_zero_fw_hh';

async function hasSentinel(db) {
  if (!db.AuditLog) return false;
  const row = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION, entity: 'System' } });
  return !!row;
}

async function writeSentinel(db, changes) {
  if (!db.AuditLog) return;
  await db.AuditLog.create({
    userId: null,
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: '00000000-0000-0000-0000-000000000000',
    changes,
    ipAddress: null,
  });
}

async function migrate428gProductPriceMarkupZero(db) {
  if (!db.Product || !db.ProductPrice) {
    logger.info('[4.28g] Product or ProductPrice model missing; skipping');
    return { skipped: true };
  }
  if (await hasSentinel(db)) {
    return { skipped: true };
  }

  // Pull every active ProductPrice row whose Product is FW or HH.
  const fwhhProducts = await db.Product.findAll({
    where: { brandCode: ['FW', 'HH'] },
    attributes: ['id', 'sku', 'brandCode'],
  });
  const productIds = fwhhProducts.map(p => p.id);
  if (productIds.length === 0) {
    await writeSentinel(db, { fixed: 0, scanned: 0, runAt: new Date().toISOString() });
    return { fixed: 0, scanned: 0 };
  }
  const productById = new Map(fwhhProducts.map(p => [p.id, p]));

  const rows = await db.ProductPrice.findAll({ where: { productId: productIds } });

  let fixed = 0;
  const summary = [];
  for (const r of rows) {
    const cost = r.costPriceUsdPerM2 != null ? Number(r.costPriceUsdPerM2) : null;
    const markup = r.markupPercent != null ? Number(r.markupPercent) : null;
    const selling = r.sellingPriceUsdPerM2 != null ? Number(r.sellingPriceUsdPerM2) : null;

    const needsMarkupReset = markup != null && markup !== 0;
    const needsExplicitSelling = (selling == null) || (cost != null && Math.abs(selling - cost) > 0.0001);

    if (!needsMarkupReset && !needsExplicitSelling) continue;

    const patch = {};
    if (needsMarkupReset) patch.markupPercent = 0;
    if (needsExplicitSelling && cost != null) patch.sellingPriceUsdPerM2 = cost;
    if (Object.keys(patch).length === 0) continue;

    await r.update(patch);
    fixed++;
    summary.push({
      productId: r.productId,
      sku: productById.get(r.productId)?.sku,
      origin: r.origin,
      before: { markupPercent: markup, sellingPriceUsdPerM2: selling },
      after: patch,
    });
  }

  // Reconcile Product.baseFobPrice so it picks up the corrected
  // sellingPriceUsdPerM2 immediately. Without this the legacy scalar
  // stays inflated until the next boot reconcile.
  let baseFobReconciled = 0;
  try {
    const productPriceService = require('./productPriceService');
    if (typeof productPriceService.reconcileBaseFobPrices === 'function') {
      const result = await productPriceService.reconcileBaseFobPrices();
      baseFobReconciled = result?.updated || 0;
    }
  } catch (e) {
    logger.warn('[4.28g] baseFobPrice reconcile skipped:', e.message);
  }

  await writeSentinel(db, {
    fixed,
    scanned: rows.length,
    baseFobReconciled,
    runAt: new Date().toISOString(),
    summary,
  });

  logger.info(`[4.28g] FW/HH ProductPrice markup zeroed: ${fixed}/${rows.length} rows, ${baseFobReconciled} baseFobPrice reconciled`);
  return { fixed, scanned: rows.length, baseFobReconciled };
}

module.exports = { migrate428gProductPriceMarkupZero };
