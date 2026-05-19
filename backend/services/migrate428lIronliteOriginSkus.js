/**
 * Phase 4.28l — split IronLite Products into origin-specific SKUs.
 *
 * 2026-05-19 Alex feedback: SKUs need to convey origin. IL-180x1220-6.5mm
 * becomes either ILMY-180x1220-6.5mm (Malaysia, FW brand) or
 * ILCN-180x1220-6.5mm (China, HH brand). Same physical board design,
 * but distinct catalog entries so the brand_code + origin + buyer-ready
 * FOB line up cleanly on each Product row.
 *
 * Before this migration:
 *   - 9 Products with sku=IL-* and brand_code='FW' but origin='China'
 *     (mismatched).
 *   - originVariants on each carried BOTH a CN entry and an MY entry.
 *   - FW PriceList items + HH PriceList items both pointed at these
 *     same 9 Products, relying on the sister-brand exemption.
 *
 * After this migration:
 *   - 9 Products renamed to ILCN-* with brand='HH', origin='China',
 *     baseFobPrice = supplier China price, originVariants = [CN only].
 *   - 9 brand-new Products with sku=ILMY-*, brand='FW',
 *     origin='Malaysia', baseFobPrice = supplier Malaysia price,
 *     originVariants = [MY only].
 *   - FW PriceList items repointed to the new ILMY Products, sku
 *     updated to ILMY-*.
 *   - HH PriceList items keep their productId (now ILCN), sku updated
 *     to ILCN-*. ProductName also updated to "... (China)".
 *
 * Idempotent via AuditLog sentinel
 * `phase4_28l_ironlite_origin_skus_split`.
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_28l_ironlite_origin_skus_split';

// Same prices as 4.28f. Repeated here so the migration is self-contained.
const IRONLITE_PRICES = {
  '6.5':  { CN: 9.095,  MY: 9.741 },
  '7.0':  { CN: 9.634,  MY: 10.280 },
  '7.5':  { CN: 10.161, MY: 10.807 },
  '8.0':  { CN: 10.699, MY: 11.345 },
  '8.5':  { CN: 11.238, MY: 11.883 },
  '9.0':  { CN: 11.765, MY: 12.411 },
  '10.0': { CN: 12.841, MY: 13.486 },
  '11.0': { CN: 13.910, MY: 14.553 },
  '12.0': { CN: 14.980, MY: 15.629 },
};

const THICKNESSES = Object.keys(IRONLITE_PRICES);
const OLD_SKU = (t) => `IL-180x1220-${t}mm`;
const CN_SKU  = (t) => `ILCN-180x1220-${t}mm`;
const MY_SKU  = (t) => `ILMY-180x1220-${t}mm`;

const FW_PRICE_LIST = '23a0e6e7-912d-4dc7-9155-be30f9c9384e'; // Malaysia
const HH_PRICE_LIST = 'c49dee71-fbb6-4552-97a6-a4be1571be0b'; // China

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

async function migrate428lIronliteOriginSkus(db) {
  if (!db.Product || !db.PriceList || !db.PriceListItem) {
    logger.info('[4.28l] models missing; skipping');
    return { skipped: true };
  }
  if (await hasSentinel(db)) {
    return { skipped: true };
  }

  const summary = { renamed: 0, created: 0, fwItemsRepointed: 0, hhItemsRepointed: 0 };

  // Need a FW factory + HH factory ID to use as factoryId on the new
  // ILMY Products. The Phase 4.28d work already corrected these brand
  // tags; pick the first FW-tagged factory for Malaysia, HH-tagged for
  // China.
  const fwFactory = await db.Factory.findOne({ where: { brandCode: 'FW' } });
  const hhFactory = await db.Factory.findOne({ where: { brandCode: 'HH' } });
  if (!fwFactory || !hhFactory) {
    logger.warn('[4.28l] FW or HH factory not found; cannot split SKUs');
    return { skipped: true, reason: 'missing_factory' };
  }

  // Need a default category to plug new ILMY Products into. The existing
  // IL- rows share a categoryId — read it from the first row.
  const sampleOld = await db.Product.findOne({ where: { sku: OLD_SKU('6.5') } });
  const defaultCategoryId = sampleOld ? sampleOld.categoryId : null;

  for (const t of THICKNESSES) {
    const prices = IRONLITE_PRICES[t];

    // ── Rename the existing IL- Product → ILCN- ─────────────────────
    const oldRow = await db.Product.findOne({ where: { sku: OLD_SKU(t) } });
    let cnProductId = null;
    if (oldRow) {
      // 4.28o (2026-05-19): the parenthetical "(China)" is redundant —
      // origin is encoded in the SKU prefix ILCN-. Drop from the name.
      const cnName = `IronLite Core 180mm x 1220mm x ${t}mm Engineered SPC`;
      await oldRow.update({
        sku: CN_SKU(t),
        name: cnName,
        brandCode: 'HH',
        originCountry: 'China',
        baseFobPrice: prices.CN,
        originVariants: [{
          originCountry: 'CN',
          fobPriceUsd: prices.CN,
          priceUnit: 'sqm',
          factoryId: hhFactory.id,
        }],
        factoryId: hhFactory.id,
      });
      cnProductId = oldRow.id;
      summary.renamed++;
    } else {
      // Already renamed in a prior run (sentinel was deleted manually)
      // or a partial run. Look up by the target SKU and use that id.
      const existing = await db.Product.findOne({ where: { sku: CN_SKU(t) } });
      if (existing) cnProductId = existing.id;
    }

    // ── Create the new ILMY- Product ────────────────────────────────
    let myProductId = null;
    const existingMy = await db.Product.findOne({ where: { sku: MY_SKU(t) } });
    if (existingMy) {
      myProductId = existingMy.id;
    } else {
      // 4.28o: same — drop the "(Malaysia)" suffix. SKU prefix ILMY- says it.
      const myName = `IronLite Core 180mm x 1220mm x ${t}mm Engineered SPC`;
      const newRow = await db.Product.create({
        id: uuidv4(),
        sku: MY_SKU(t),
        name: myName,
        brandCode: 'FW',
        originCountry: 'Malaysia',
        productType: 'engineered_spc',
        baseFobPrice: prices.MY,
        currency: 'USD',
        unit: 'sqm',
        categoryId: defaultCategoryId,
        factoryId: fwFactory.id,
        leadTimeDays: 30,
        originVariants: [{
          originCountry: 'MY',
          fobPriceUsd: prices.MY,
          priceUnit: 'sqm',
          factoryId: fwFactory.id,
        }],
        isActive: true,
      });
      myProductId = newRow.id;
      summary.created++;
    }

    // ── Repoint FW PriceList items (Malaysia) ──────────────────────
    if (myProductId) {
      const fwItems = await db.PriceListItem.findAll({
        where: { priceListId: FW_PRICE_LIST, sku: [OLD_SKU(t), MY_SKU(t)] },
      });
      for (const it of fwItems) {
        await it.update({
          productId: myProductId,
          sku: MY_SKU(t),
          productName: `IronLite Core 180mm x 1220mm x ${t}mm Engineered SPC`,
        });
        summary.fwItemsRepointed++;
      }
    }

    // ── Repoint HH PriceList items (China) ─────────────────────────
    if (cnProductId) {
      const hhItems = await db.PriceListItem.findAll({
        where: { priceListId: HH_PRICE_LIST, sku: [OLD_SKU(t), CN_SKU(t)] },
      });
      for (const it of hhItems) {
        await it.update({
          productId: cnProductId,
          sku: CN_SKU(t),
          productName: `IronLite Core 180mm x 1220mm x ${t}mm Engineered SPC (China)`,
        });
        summary.hhItemsRepointed++;
      }
    }
  }

  await writeSentinel(db, { ...summary, runAt: new Date().toISOString() });
  logger.info(`[4.28l] IronLite origin SKUs split: ${JSON.stringify(summary)}`);
  return summary;
}

module.exports = {
  migrate428lIronliteOriginSkus,
  IRONLITE_PRICES,
  THICKNESSES,
  OLD_SKU, CN_SKU, MY_SKU,
};
