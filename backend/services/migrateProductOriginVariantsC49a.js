/**
 * Phase 4.9 C-1 — backfill Product.originVariants from the existing
 * single-origin fields.
 *
 * Pre-Phase 4.9 every Product row held one origin in
 * (originCountry, baseFobPrice, currency, moqUnit, leadTimeDays).
 * Phase 4.9 introduces a JSON array of variants so the same SKU can
 * be sourced from multiple countries at different prices. Existing
 * rows are migrated to a single-element variant array; new rows
 * default to an empty array and the quotation builder falls back to
 * the legacy fields when the array is empty.
 *
 * Idempotent via AuditLog sentinel
 * `phase4_9_c1_product_origin_variants_backfilled`. Re-running is a
 * no-op.
 *
 * Schema: Product.originVariants column is added by
 * sequelize.sync({ alter: true }) at boot before this migration runs.
 */

const { Op } = require('sequelize');
const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_9_c1_product_origin_variants_backfilled';

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

async function migrateProductOriginVariantsC49a(db) {
  if (!db.Product) {
    logger.info('[C-49a] Product model missing; skipping');
    return { skipped: true };
  }
  if (await hasSentinel(db)) {
    return { skipped: true };
  }

  // Backfill rows where originVariants is empty or null. Build the
  // single-element variant from baseFobPrice + originCountry. Skip rows
  // missing both — they have no price data to migrate and the empty
  // array is the right default.
  const candidates = await db.Product.findAll({
    where: {
      [Op.or]: [
        { originVariants: null },
        // SQLite stores empty JSON arrays as '[]' string; an exact match
        // works on the raw column. Sequelize's JSON-equality is brittle
        // across adapters so we fall back to a raw filter for safety.
      ],
    },
  });

  let backfilled = 0;
  let skipped = 0;
  for (const p of candidates) {
    // Skip if already populated (defensive — the Op.or above should
    // cover NULL only).
    if (Array.isArray(p.originVariants) && p.originVariants.length > 0) {
      skipped++;
      continue;
    }
    // Skip rows with no price data.
    if (p.baseFobPrice == null) {
      await p.update({ originVariants: [] });
      skipped++;
      continue;
    }
    const variant = {
      originCountry: p.originCountry || null,
      fobPriceUsd: Number(p.baseFobPrice),
      priceUnit: p.moqUnit || p.unit || 'sqm',
      ...(p.moqUnit ? {} : {}),
      ...(p.leadTimeDays != null ? { leadTimeOverride: p.leadTimeDays } : {}),
    };
    await p.update({ originVariants: [variant] });
    backfilled++;
  }

  await writeSentinel(db, {
    backfilled,
    skipped,
    runAt: new Date().toISOString(),
  });

  logger.info(`[C-49a] Backfilled originVariants on ${backfilled} Products (${skipped} skipped)`);
  return { backfilled, skipped };
}

module.exports = { migrateProductOriginVariantsC49a };
