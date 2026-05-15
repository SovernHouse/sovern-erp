/**
 * Phase 4.8, Commit 3a — backfill leadNumber on existing Leads.
 *
 * Walks Lead rows where leadNumber IS NULL ordered by createdAt ASC.
 * For each row, builds the LD-YYYYMMDD-NNN value using the date portion
 * of createdAt (UTC) and a counter that resets per day. The order
 * guarantees that earlier-created rows on the same day get lower
 * counters, which keeps the human-readable identifier monotonic with
 * creation order even though createdAt timestamps are not exposed to
 * the user.
 *
 * Idempotent via AuditLog sentinel `phase4_8_lead_numbers_backfilled`.
 * After the sentinel exists the migration is a no-op on every
 * subsequent boot.
 *
 * Schema: leadNumber column is added by autoMigrateSchema() at boot
 * via sequelize.sync({ alter: true }) before this migration runs.
 */

const logger = require('../utils/logger');
const { dateString } = require('./leadNumberGenerator');

const SENTINEL_ACTION = 'phase4_8_lead_numbers_backfilled';

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

async function migrateLeadNumberC3a(db) {
  if (!db.Lead) {
    logger.info('[C3a] Lead model missing; skipping');
    return { skipped: true };
  }
  if (await hasSentinel(db)) {
    return { skipped: true };
  }

  const rows = await db.Lead.findAll({
    where: { leadNumber: null },
    order: [['createdAt', 'ASC']],
    attributes: ['id', 'createdAt'],
  });

  if (rows.length === 0) {
    await writeSentinel(db, { backfilled: 0, note: 'No null-leadNumber rows at run time.' });
    return { backfilled: 0 };
  }

  // Group by date prefix; assign monotonic counter within each day.
  const counters = {};
  const assignments = []; // [{ id, leadNumber }]
  for (const row of rows) {
    const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    const prefix = `LD-${dateString(created)}-`;
    counters[prefix] = (counters[prefix] || 0) + 1;
    const leadNumber = `${prefix}${String(counters[prefix]).padStart(3, '0')}`;
    assignments.push({ id: row.id, leadNumber });
  }

  let updated = 0;
  for (const a of assignments) {
    await db.Lead.update({ leadNumber: a.leadNumber }, { where: { id: a.id } });
    updated++;
  }

  await writeSentinel(db, {
    backfilled: updated,
    sampleFirst: assignments[0],
    sampleLast: assignments[assignments.length - 1],
    runAt: new Date().toISOString(),
  });

  logger.info(`[C3a] Backfilled ${updated} Lead.leadNumber values`);
  return { backfilled: updated };
}

module.exports = { migrateLeadNumberC3a };
