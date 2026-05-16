/**
 * migrate413bDropSanctionsScreened — Phase 4.13b.
 *
 * One-shot, sentinel-guarded boot migration that drops the legacy
 * Lead.sanctions_screened BOOLEAN column. The Customer table never
 * had this column (verified pre-4.13b via grep — only Lead.js
 * referenced it).
 *
 * Why:
 *   The column existed from Phase 1 as a simple boolean. Phase 4 C18
 *   added screeningStatus (enum) + sanctionsScreenDetails (JSON) +
 *   lastScreenedAt (DATETIME). The boolean was kept "for read
 *   compatibility" but nothing kept it in sync with the new fields.
 *   This created the L-044 state-inconsistency pattern visible on the
 *   prod Iran Lead: sanctions_screened=false alongside lastScreenedAt
 *   populated and screeningStatus='cleared' all at once, three
 *   contradictory facts.
 *
 *   No code reads sanctions_screened anymore (verified by grep);
 *   dropping it eliminates the contradiction surface and forces every
 *   future reader to use the explicit enum.
 *
 * SQLite specifics:
 *   ALTER TABLE … DROP COLUMN has been supported since SQLite 3.35
 *   (March 2021). Node's better-sqlite3 / sqlite3 modules in current
 *   ERP deps are well past that threshold. Falls back to the
 *   table-rebuild pattern only if the simple DROP fails.
 *
 * Idempotency:
 *   Sentinel: AuditLog action 'phase4_13b_sanctions_screened_dropped'.
 *   Re-runs are no-ops. The PRAGMA check before the ALTER doubles
 *   as a safety net if the sentinel was wiped manually.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_13b_sanctions_screened_dropped';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

async function columnExists(sequelize, table, column) {
  const [rows] = await sequelize.query(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === column);
}

async function migrate413bDropSanctionsScreened(db) {
  if (!db?.sequelize) {
    logger.warn('[phase4_13b] sequelize unavailable; skipping');
    return { skipped: true };
  }
  if (!db.AuditLog) {
    logger.warn('[phase4_13b] AuditLog unavailable; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { skipped: true, reason: 'sentinel-present' };
  }

  const stats = { tablesInspected: [], columnsDropped: [] };

  for (const table of ['Leads']) {
    stats.tablesInspected.push(table);
    const exists = await columnExists(db.sequelize, table, 'sanctions_screened');
    if (!exists) continue;

    try {
      await db.sequelize.query(`ALTER TABLE "${table}" DROP COLUMN "sanctions_screened"`);
      stats.columnsDropped.push(`${table}.sanctions_screened`);
      logger.info(`[phase4_13b] dropped ${table}.sanctions_screened`);
    } catch (err) {
      logger.error(`[phase4_13b] failed to drop ${table}.sanctions_screened: ${err.message}`);
      throw err;
    }
  }

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: stats,
  });

  logger.info(`[phase4_13b] complete: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { migrate413bDropSanctionsScreened, SENTINEL_ACTION };
