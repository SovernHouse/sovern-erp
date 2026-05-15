/**
 * Phase 4.9 C-2 — Tariff rate seed.
 *
 * Inserts the two rate rows Alex confirmed in the Phase 4.9 plan:
 *   - China -> USA: 40.7714% (HanHua factory note May 14, 2026)
 *   - Malaysia -> USA: 15.5214% (same source)
 *
 * Both rows have effectiveFrom = effectiveUntil = 2026-05-15 per Alex's
 * "seed as stated" call. They are immediately expired on first deploy
 * day — which is by design: C-5's hard warning fires on every USA
 * quotation, forcing Alex to confirm with the factory before quoting a
 * stale number. This is the right default given US tariff volatility.
 *
 * Idempotent: rows are matched on the composite key (originCountry,
 * destinationCountry, effectiveFrom). Re-running the seed never
 * duplicates and never overwrites existing rows. Alex's edits via the
 * admin UI survive future deploys.
 */

const logger = require('../utils/logger');

const SEED_ROWS = [
  {
    originCountry: 'CN',
    destinationCountry: 'US',
    ratePercent: 40.7714,
    effectiveFrom: '2026-05-14',
    effectiveUntil: '2026-05-15',
    sourceNote: 'HanHua factory note May 14, 2026. Combined US import duty stack on flooring (MFN + Section 301 + IEEPA + reciprocal) at time of note.',
    brandCode: null,
  },
  {
    originCountry: 'MY',
    destinationCountry: 'US',
    ratePercent: 15.5214,
    effectiveFrom: '2026-05-14',
    effectiveUntil: '2026-05-15',
    sourceNote: 'HanHua factory note May 14, 2026. Combined US import duty stack on flooring (MFN base + reciprocal) at time of note.',
    brandCode: null,
  },
];

async function seedTariffRatesIfMissing(db) {
  if (!db || !db.TariffRate) {
    logger.warn('[seedTariffRates] TariffRate model missing; skipping seed');
    return { skipped: true };
  }

  let inserted = 0;
  let skipped = 0;
  for (const row of SEED_ROWS) {
    const existing = await db.TariffRate.findOne({
      where: {
        originCountry: row.originCountry,
        destinationCountry: row.destinationCountry,
        effectiveFrom: row.effectiveFrom,
      },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await db.TariffRate.create(row);
    inserted++;
  }

  if (inserted > 0) {
    logger.info(`[seedTariffRates] Inserted ${inserted} tariff rate(s); skipped ${skipped} existing`);
  }
  return { inserted, skipped };
}

module.exports = { seedTariffRatesIfMissing, SEED_ROWS };
