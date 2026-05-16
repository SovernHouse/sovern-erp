/**
 * migrate415c1ProductCubicMeters — Phase 4.15c-1.
 *
 * One-shot, sentinel-guarded boot migration that adds the
 * Product.cubic_meters DECIMAL(10,4) column. Drives the container
 * loading optimizer (optimizeContainerLoad) and feeds packing-list /
 * shipment-document generation.
 *
 * Idempotent via AuditLog action 'phase4_15c1_product_cubic_meters_added'.
 * PRAGMA check before the ALTER doubles as a safety net if the sentinel
 * is wiped manually.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_15c1_product_cubic_meters_added';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

async function columnExists(sequelize, table, column) {
  const [rows] = await sequelize.query(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === column);
}

async function migrate415c1ProductCubicMeters(db) {
  if (!db?.sequelize) {
    logger.warn('[phase4_15c1] sequelize unavailable; skipping');
    return { skipped: true };
  }
  if (!db.AuditLog) {
    logger.warn('[phase4_15c1] AuditLog unavailable; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { skipped: true, reason: 'sentinel-present' };
  }

  // Phase 4.17 follow-up: original code used 'Products' (plural) but the
  // active table is 'Product' (singular per the project's freezeTableName
  // convention). The mistake caused this migration to ALTER a nonexistent
  // table on every restart, logging the failure but never crashing because
  // the boot wrapper catches it. The 4.16.4 Product-table rebuild already
  // included cubic_meters in the new schema, so on prod the column exists
  // even though this migration never ran successfully. Sentinel write
  // below now finally records the no-op so we stop retrying.
  const stats = { columnsAdded: [] };
  const exists = await columnExists(db.sequelize, 'Product', 'cubic_meters');
  if (!exists) {
    try {
      await db.sequelize.query(
        'ALTER TABLE "Product" ADD COLUMN "cubic_meters" DECIMAL(10,4) NULL'
      );
      stats.columnsAdded.push('Product.cubic_meters');
      logger.info('[phase4_15c1] added Product.cubic_meters');
    } catch (err) {
      logger.error(`[phase4_15c1] failed to add Product.cubic_meters: ${err.message}`);
      throw err;
    }
  } else {
    stats.skipped = 'column-already-exists';
  }

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: stats,
  });

  logger.info(`[phase4_15c1] complete: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { migrate415c1ProductCubicMeters, SENTINEL_ACTION };
