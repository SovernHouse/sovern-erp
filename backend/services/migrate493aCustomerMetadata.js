/**
 * Phase 4.9.3a — Customer.metadata column.
 *
 * Adds a single JSON column for AI-tool-written extras (industry,
 * yearFounded, website, source, primaryAddress object, additional
 * addresses array). Keeps the existing typed columns intact so all
 * current readers continue working.
 *
 * Idempotent via sentinel `phase4_9_3a_customer_metadata_added`.
 * Per-column ALTER guarded by PRAGMA inspection + try/catch on the
 * duplicate-column race per L-046.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_9_3a_customer_metadata_added';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

async function columnExists(sequelize, table, column) {
  const [rows] = await sequelize.query(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === column);
}

async function migrate493aCustomerMetadata(db) {
  if (!db?.AuditLog || !db.sequelize) {
    logger.warn('[migrate-493a] required deps missing; skipping');
    return { skipped: true };
  }
  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) return { alreadyRun: true };

  let added = false;
  if (await columnExists(db.sequelize, 'Customer', 'metadata')) {
    logger.info('[migrate-493a] SKIPPED Customer.metadata (already exists)');
  } else {
    try {
      await db.sequelize.query(`ALTER TABLE Customer ADD COLUMN metadata JSON DEFAULT '{}'`);
      logger.info('[migrate-493a] ADDED column Customer.metadata');
      added = true;
    } catch (err) {
      if (/duplicate column/i.test(err.message)) {
        logger.info('[migrate-493a] SKIPPED Customer.metadata (duplicate on race)');
      } else throw err;
    }
  }

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: { added },
  });

  return { added };
}

module.exports = { migrate493aCustomerMetadata, SENTINEL_ACTION };
