/**
 * Phase 4.8 Commit 3b hotfix — bump legacy Lead.status='prospect' rows
 * to 'contacted'.
 *
 * The Lead.status enum is `new | contacted | qualified | proposal |
 * negotiation | won | lost` (7 values). Prod inspection during the 5a
 * rewire verification found 9 rows at `status='prospect'`, which is
 * not in the current enum — almost certainly a stale value from an
 * earlier enum definition or a raw import that bypassed the ORM-layer
 * enum check (SQLite does not enforce ENUMs at the DB layer).
 *
 * Without this migration, the new Pipeline view's bucketing logic
 * (pipeline[lead.status]) silently drops those 9 rows from the
 * kanban. Alex chose to remap them to 'contacted' per the audit
 * conversation: "you have reached out but haven't qualified them
 * yet" — the safest assumption that doesn't claim a warmer stage
 * than the data supports.
 *
 * Idempotent via AuditLog sentinel `phase4_8_lead_prospect_remapped`.
 * The remap is also a no-op when no `prospect` rows exist.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_8_lead_prospect_remapped';

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

async function migrateLeadProspectStatusC3b(db) {
  if (!db.Lead) {
    logger.info('[C3b/prospect] Lead model missing; skipping');
    return { skipped: true };
  }
  if (await hasSentinel(db)) {
    return { skipped: true };
  }

  // Raw SQL because sequelize will reject `where: { status: 'prospect' }`
  // against an enum that doesn't include the value on some adapter
  // versions. The .update() avoids that path entirely.
  const [results] = await db.sequelize.query(
    `UPDATE Leads SET status = 'contacted' WHERE status = 'prospect'`,
  );

  // affectedRows shape varies by adapter; just count after.
  const [[{ remaining }]] = await db.sequelize.query(
    `SELECT COUNT(*) AS remaining FROM Leads WHERE status = 'prospect'`,
  );

  await writeSentinel(db, {
    remappedFromProspect: 'see logs',
    remainingProspect: Number(remaining),
    bucketChosen: 'contacted',
    runAt: new Date().toISOString(),
  });

  logger.info(`[C3b/prospect] Lead.status='prospect' remapped to 'contacted'. Remaining=${remaining}`);
  return { remappedTo: 'contacted', remainingProspect: Number(remaining) };
}

module.exports = { migrateLeadProspectStatusC3b };
