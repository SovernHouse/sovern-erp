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

// Component breakdowns are illustrative defaults — Alex confirmed the
// totals (40.7714% and 15.5214%) from the HanHua note but did not name
// every contributing tariff. The components below sum to the totals and
// will be replaced as soon as the real HTS reading is available; the
// admin UI lets him edit each named row in place.
const SEED_ROWS = [
  {
    originCountry: 'CN',
    destinationCountry: 'US',
    ratePercent: 40.7714,
    components: [
      { name: 'MFN base (HTS column 1)', ratePercent: 3.2,    note: 'Flooring HTS placeholder. Confirm against actual HTS code at quote time.' },
      { name: 'Section 301',             ratePercent: 25.0,   note: 'USTR China-specific tariff.' },
      { name: 'IEEPA reciprocal',        ratePercent: 10.0,   note: '2026 reciprocal tariff stack.' },
      { name: 'IEEPA fentanyl (CN)',     ratePercent: 2.1500, note: 'China-specific IEEPA addition.' },
      { name: 'MPF (merchandise fee)',   ratePercent: 0.3464, note: 'Merchandise Processing Fee, capped.' },
      { name: 'HMF (harbor maintenance)',ratePercent: 0.0750, note: 'Harbor Maintenance Fee on ocean freight.' },
    ],
    effectiveFrom: '2026-05-14',
    effectiveUntil: '2026-05-15',
    sourceNote: 'HanHua factory note May 14, 2026. Combined US import duty stack on flooring at time of note.',
    brandCode: null,
  },
  {
    originCountry: 'MY',
    destinationCountry: 'US',
    ratePercent: 15.5214,
    components: [
      { name: 'MFN base (HTS column 1)', ratePercent: 5.0,    note: 'Flooring HTS placeholder. Confirm at quote time.' },
      { name: 'IEEPA reciprocal',        ratePercent: 10.0,   note: '2026 reciprocal tariff stack on Malaysia.' },
      { name: 'MPF (merchandise fee)',   ratePercent: 0.3464, note: 'Merchandise Processing Fee, capped.' },
      { name: 'HMF (harbor maintenance)',ratePercent: 0.1750, note: 'Harbor Maintenance Fee on ocean freight.' },
    ],
    effectiveFrom: '2026-05-14',
    effectiveUntil: '2026-05-15',
    sourceNote: 'HanHua factory note May 14, 2026. Combined US import duty stack on flooring at time of note.',
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
