/**
 * Phase 4.9 C-3 follow-up — backfill TariffRate.components.
 *
 * Existing rows have an opaque ratePercent and an empty components
 * array. Two-stage backfill:
 *
 *   1. For rows that match a seed-row (same origin/destination/
 *      effectiveFrom) AND currently have empty components, write the
 *      named breakdown from the seed. This is the typical case for
 *      Alex's two seeded rows.
 *   2. For any remaining row with empty components, write a single
 *      "Total tariff" component so the downstream UI never crashes on
 *      a null/empty components array.
 *
 * Idempotent via AuditLog sentinel
 * `phase4_9_c3_2_tariff_rate_components_backfilled`. Re-running the
 * migration after the sentinel is present is a no-op.
 */

const logger = require('../utils/logger');
const { SEED_ROWS } = require('./seedTariffRatesC49b');

const SENTINEL_ACTION = 'phase4_9_c3_2_tariff_rate_components_backfilled';

async function migrateTariffRateComponentsC49c2(db) {
  if (!db || !db.TariffRate || !db.AuditLog) {
    logger.warn('[migrate-tariff-components] required models missing; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { alreadyRun: true };
  }

  const rows = await db.TariffRate.findAll();
  let seedMatched = 0;
  let genericBackfilled = 0;
  let alreadyOk = 0;

  for (const row of rows) {
    const current = Array.isArray(row.components) ? row.components : [];
    if (current.length > 0) {
      alreadyOk++;
      continue;
    }
    const seedMatch = SEED_ROWS.find(s =>
      s.originCountry === row.originCountry &&
      s.destinationCountry === row.destinationCountry &&
      s.effectiveFrom === (row.effectiveFrom instanceof Date ? row.effectiveFrom.toISOString().slice(0, 10) : row.effectiveFrom),
    );
    if (seedMatch && Array.isArray(seedMatch.components) && seedMatch.components.length > 0) {
      await row.update({ components: seedMatch.components });
      seedMatched++;
    } else {
      await row.update({
        components: [{ name: 'Total tariff', ratePercent: Number(row.ratePercent) }],
      });
      genericBackfilled++;
    }
  }

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'TariffRate',
    entityId: null,
    userId: null,
    changes: { seedMatched, genericBackfilled, alreadyOk, totalRows: rows.length },
  });

  logger.info(`[migrate-tariff-components] seedMatched=${seedMatched} genericBackfilled=${genericBackfilled} alreadyOk=${alreadyOk}`);
  return { seedMatched, genericBackfilled, alreadyOk };
}

module.exports = { migrateTariffRateComponentsC49c2, SENTINEL_ACTION };
