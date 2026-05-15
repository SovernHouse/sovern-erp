/**
 * Phase 4.9.1 RECOVERY — corrects the partial state left by
 * migrate491TaxonomyAndBrand on first deploy.
 *
 * Three things went wrong on the first run:
 *
 *   1. The original recon read the wrong table. Prod has TWO tables:
 *      `ProductCategory` (singular, 18 rows, dead/orphan) and
 *      `ProductCategories` (plural, 59 rows, what the app actually
 *      uses). My initial inspection hit the singular one, so the
 *      reparent plan referenced category names that didn't exist in
 *      the live table.
 *   2. Net effect: `Resilient` was created as a SIBLING of SPC/LVT/WPC
 *      under `Flooring`, not as their parent. `Engineered SPC` landed
 *      correctly under `Resilient` but with no siblings. `Engineered
 *      Wood` was incorrectly re-parented to `Resilient`.
 *   3. Sentinel write failed silently. The AuditLog model requires
 *      entityId NOT NULL; I passed null. Boot try/catch swallowed the
 *      throw to a warning. Other sentinel writers (e.g.
 *      migrateArchiveTaxonomyC21Followup.js:40) use a zero-UUID for
 *      System-scoped sentinels — adopt the same convention here.
 *
 * This recovery script:
 *   a) Re-parents SPC / WPC / LVT / Vinyl Sheet from Flooring → Resilient
 *      with the sort orders Alex specified (1, 2, 5, 6).
 *   b) Restores Engineered Wood under Flooring (sortOrder=11).
 *   c) Archives IronCore Flooring + WPC Hybrid Flooring (your original
 *      spec was right — they DO exist on prod; my first recon missed
 *      them in the wrong table).
 *   d) Writes a `phase4_9_1_recovery_completed` sentinel WITH a
 *      zero-UUID entityId so it actually persists. Re-runs are no-ops.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_9_1_recovery_completed';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

// Live names from prod ProductCategories (sqlite3 verified).
const REPARENT_TO_RESILIENT = [
  { name: 'SPC (Stone Plastic Composite)',  sortOrder: 1 },
  { name: 'WPC (Wood Plastic Composite)',   sortOrder: 2 },
  { name: 'LVT (Luxury Vinyl Tile)',        sortOrder: 5 },
  { name: 'Vinyl Sheet',                    sortOrder: 6 },
];

const REPARENT_TO_FLOORING = [
  { name: 'Engineered Wood', sortOrder: 11 },
];

const TO_ARCHIVE = [
  'IronCore Flooring',
  'WPC Hybrid Flooring',
];

async function migrate491Recovery(db) {
  if (!db?.ProductCategory || !db?.AuditLog) {
    logger.warn('[migrate-491-recovery] required models missing; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { alreadyRun: true };
  }

  const PC = db.ProductCategory;

  // Find the two parent rows. If either is missing, bail loudly —
  // we don't want to silently fall back to a different shape.
  const flooring = await PC.findOne({ where: { name: 'Flooring', parentId: null } });
  if (!flooring) {
    throw new Error('[migrate-491-recovery] Flooring top-level not found');
  }
  const resilient = await PC.findOne({ where: { name: 'Resilient', parentId: flooring.id } });
  if (!resilient) {
    throw new Error('[migrate-491-recovery] Resilient under Flooring not found');
  }

  const result = {
    movedToResilient: [],
    movedToFlooring: [],
    archived: [],
    notFound: [],
  };

  // a) Re-parent under Resilient.
  for (const plan of REPARENT_TO_RESILIENT) {
    const row = await PC.findOne({ where: { name: plan.name } });
    if (!row) {
      result.notFound.push(plan.name);
      logger.info(`[migrate-491-recovery] reparent SKIP: "${plan.name}" not found`);
      continue;
    }
    if (row.parentId === resilient.id && Number(row.sortOrder) === plan.sortOrder) continue;
    await row.update({ parentId: resilient.id, sortOrder: plan.sortOrder });
    result.movedToResilient.push({ name: plan.name, sortOrder: plan.sortOrder });
    logger.info(`[migrate-491-recovery] reparented "${plan.name}" → Resilient (sortOrder=${plan.sortOrder})`);
  }

  // b) Engineered Wood back to Flooring.
  for (const plan of REPARENT_TO_FLOORING) {
    const row = await PC.findOne({ where: { name: plan.name } });
    if (!row) {
      result.notFound.push(plan.name);
      continue;
    }
    if (row.parentId === flooring.id && Number(row.sortOrder) === plan.sortOrder) continue;
    await row.update({ parentId: flooring.id, sortOrder: plan.sortOrder });
    result.movedToFlooring.push({ name: plan.name, sortOrder: plan.sortOrder });
    logger.info(`[migrate-491-recovery] reparented "${plan.name}" → Flooring (sortOrder=${plan.sortOrder})`);
  }

  // c) Archive orphan flooring rows.
  for (const name of TO_ARCHIVE) {
    const row = await PC.findOne({ where: { name } });
    if (!row) {
      result.notFound.push(name);
      logger.info(`[migrate-491-recovery] archive SKIP: "${name}" not found`);
      continue;
    }
    if (row.isArchived) {
      logger.info(`[migrate-491-recovery] archive SKIP: "${name}" already archived`);
      continue;
    }
    await row.update({ isArchived: true });
    result.archived.push(name);
    logger.info(`[migrate-491-recovery] archived "${name}"`);
  }

  // d) Sentinel write with proper UUID so it persists.
  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: result,
  });

  logger.info(`[migrate-491-recovery] complete: ${result.movedToResilient.length} → Resilient, ${result.movedToFlooring.length} → Flooring, ${result.archived.length} archived`);
  return result;
}

module.exports = { migrate491Recovery, SENTINEL_ACTION };
