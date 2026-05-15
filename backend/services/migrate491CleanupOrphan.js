/**
 * Phase 4.9.1 data hygiene — rename the orphan ProductCategory table.
 *
 * Prod has both `ProductCategory` (singular, 18 rows from 2026-04-11,
 * dead) and `ProductCategories` (plural, 59 rows, the live table the
 * ProductCategory model writes to). The singular was leftover from an
 * early build and confused recon during the 4.9.1 first run (L-048).
 *
 * Safer than DROP per the standing rule on destructive ops: RENAME
 * with a `_orphan_<yyyymmdd>` suffix. Data preserved for one retention
 * window; a future commit can DROP after Alex confirms nothing missed.
 *
 * Idempotent via:
 *   1. AuditLog sentinel `phase4_9_1_orphan_table_renamed`.
 *   2. Pre-rename existence check: skip if the source doesn't exist
 *      OR if the target already exists.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_9_1_orphan_table_renamed';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

const SOURCE_TABLE = 'ProductCategory';
const TARGET_TABLE = 'ProductCategory_orphan_20260515';

async function tableExists(sequelize, name) {
  const [rows] = await sequelize.query(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=:name`,
    { replacements: { name } },
  );
  return rows.length > 0;
}

async function migrate491CleanupOrphan(db) {
  if (!db?.AuditLog || !db.sequelize) {
    logger.warn('[cleanup-491] required deps missing; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { alreadyRun: true };
  }

  const sourceExists = await tableExists(db.sequelize, SOURCE_TABLE);
  const targetExists = await tableExists(db.sequelize, TARGET_TABLE);

  if (!sourceExists) {
    logger.info(`[cleanup-491] SKIPPED: ${SOURCE_TABLE} does not exist (nothing to rename)`);
    await db.AuditLog.create({
      action: SENTINEL_ACTION,
      entity: 'System',
      entityId: SYSTEM_ENTITY_ID,
      userId: null,
      changes: { skipped: 'source table absent', source: SOURCE_TABLE, target: TARGET_TABLE },
    });
    return { skipped: 'source absent' };
  }
  if (targetExists) {
    logger.info(`[cleanup-491] SKIPPED: ${TARGET_TABLE} already exists (cleanup already ran or naming collision)`);
    await db.AuditLog.create({
      action: SENTINEL_ACTION,
      entity: 'System',
      entityId: SYSTEM_ENTITY_ID,
      userId: null,
      changes: { skipped: 'target already exists', source: SOURCE_TABLE, target: TARGET_TABLE },
    });
    return { skipped: 'target exists' };
  }

  // Capture row count for the audit trail before renaming.
  const [countRows] = await db.sequelize.query(`SELECT COUNT(*) AS n FROM ${SOURCE_TABLE}`);
  const preservedRowCount = countRows[0]?.n ?? 0;

  await db.sequelize.query(`ALTER TABLE ${SOURCE_TABLE} RENAME TO ${TARGET_TABLE}`);
  logger.info(`[cleanup-491] RENAMED ${SOURCE_TABLE} → ${TARGET_TABLE} (${preservedRowCount} rows preserved)`);

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: {
      renamed: true,
      source: SOURCE_TABLE,
      target: TARGET_TABLE,
      preservedRowCount,
      reason: 'Orphan table from an early build. The live ProductCategory model writes to ProductCategories (plural). See L-048 in skills/lessons.md.',
    },
  });

  return { renamed: true, preservedRowCount, source: SOURCE_TABLE, target: TARGET_TABLE };
}

module.exports = { migrate491CleanupOrphan, SENTINEL_ACTION, SOURCE_TABLE, TARGET_TABLE };
