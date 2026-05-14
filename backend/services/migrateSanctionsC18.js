/**
 * Phase 4, C18 — sanctions screening backfill.
 *
 * autoMigrateSchema() at boot adds the new columns (screeningStatus,
 * sanctionsScreenDetails, lastScreenedAt, etc.) as nullable TEXT/JSON.
 * Existing Customer/Lead rows are NULL on screeningStatus, which the
 * Sequelize ENUM validator rejects on read in strict modes. This
 * migration sets the default 'pending' on every NULL row so:
 *   - the 4 hard-block points see a coherent enum value
 *   - the 90d rescreen cron has a NULL lastScreenedAt to flag for
 *     re-screening on its next run
 *
 * Idempotent via AuditLog sentinel `phase4_sanctions_backfilled`.
 * Re-runs are no-ops.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_sanctions_backfilled';

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

async function migrateSanctionsC18(db) {
  if (await hasSentinel(db)) return { skipped: true };

  let customerUpdated = 0;
  let leadUpdated = 0;

  // Note: Customer table is singular (freezeTableName/tableName), Leads is
  // plural. Use the model's getTableName() so this stays correct if the
  // convention ever drifts.
  const CUSTOMER_TABLE = (db.Customer && typeof db.Customer.getTableName === 'function')
    ? db.Customer.getTableName()
    : 'Customer';
  const LEAD_TABLE = (db.Lead && typeof db.Lead.getTableName === 'function')
    ? db.Lead.getTableName()
    : 'Leads';

  try {
    const [, custRes] = await db.sequelize.query(
      `UPDATE "${CUSTOMER_TABLE}" SET screening_status = 'pending' WHERE screening_status IS NULL`
    );
    customerUpdated = custRes?.changes || custRes?.rowCount || 0;
  } catch (e) {
    logger.warn(`[C18] Customer screening_status backfill warning: ${e.message || e}`);
  }

  try {
    const [, leadRes] = await db.sequelize.query(
      `UPDATE "${LEAD_TABLE}" SET screening_status = 'pending' WHERE screening_status IS NULL`
    );
    leadUpdated = leadRes?.changes || leadRes?.rowCount || 0;
  } catch (e) {
    logger.warn(`[C18] Lead screening_status backfill warning: ${e.message || e}`);
  }

  await writeSentinel(db, {
    customerUpdated,
    leadUpdated,
    runAt: new Date().toISOString(),
  });

  if (customerUpdated || leadUpdated) {
    logger.info(`[C18] sanctions backfill: ${customerUpdated} customers, ${leadUpdated} leads set to 'pending'`);
  }
  return { customerUpdated, leadUpdated };
}

module.exports = { migrateSanctionsC18 };
