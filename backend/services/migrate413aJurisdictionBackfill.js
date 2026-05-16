/**
 * migrate413aJurisdictionBackfill — Phase 4.13a.
 *
 * One-shot, sentinel-guarded boot migration that re-screens every Lead
 * and Customer with the new jurisdiction-aware screener and updates
 * screening_status when the new logic disagrees with the stored value.
 *
 * Why this exists:
 *   Phase 4.12 verification turned up a real production false-negative
 *   — a Lead created with country='Iran' cleared sanctions screening
 *   because the pre-4.13a screener only fuzzy-matched names against
 *   the OFAC SDN list and ignored country-level comprehensive sanctions.
 *   4.13a fixes the screener; this migration brings every existing
 *   row up to the new standard.
 *
 * Behaviour:
 *   - For each Lead and Customer with country set:
 *       - re-run sanctionsService.screenName(name, country)
 *       - if the new result is 'flagged' AND the stored screening_status
 *         is NOT already 'flagged' / 'blocked' / 'override':
 *           - update screening_status = 'flagged'
 *           - append the new jurisdiction hits to sanctions_screen_details
 *           - update last_screened_at = now
 *           - write a phase4_13a_jurisdiction_rescreen AuditLog row
 *       - if the row carries a 'manual_db_override' marker (Alex's
 *         pre-fix manual block on prod), skip update entirely — the
 *         manual decision wins.
 *   - Sentinel-guarded by AuditLog action='phase4_13a_jurisdiction_backfilled'.
 *     Re-runs are no-ops.
 *
 * Idempotency: even without the sentinel, a second run would find the
 * existing rows already at 'flagged' or 'blocked' and skip them — but
 * the sentinel saves the table scan on every boot.
 */

const logger = require('../utils/logger');
const sanctionsService = require('./sanctionsService');

const SENTINEL_ACTION = 'phase4_13a_jurisdiction_backfilled';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

// Statuses we should not overwrite. A row already flagged, blocked, or
// explicitly overridden has been reviewed (automated or human) and the
// new screen result must not undo that decision.
const PROTECTED_STATUSES = new Set(['flagged', 'blocked', 'override']);

function hasManualOverrideMarker(details) {
  // Phase 4.13b: SQLite + Sequelize sometimes hands back DataTypes.JSON
  // fields as raw strings (observed on the prod Iran backfill — the row
  // was correctly preserved by the PROTECTED_STATUSES fallback, but the
  // manual-override counter was off by one because Array.isArray()
  // returned false on a stringified JSON payload). Parse the string
  // form here so the marker check works regardless of how Sequelize
  // hydrates the column on this driver.
  let arr = details;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { return false; }
  }
  if (!Array.isArray(arr)) return false;
  return arr.some(h => h && h.reviewer === 'manual_db_override');
}

async function rescreenModel(db, Model, entityLabel, stats) {
  if (!Model) return;

  // Pull only rows with a country set — jurisdiction screen needs it.
  const { Op } = require('sequelize');
  const rows = await Model.findAll({
    where: { country: { [Op.ne]: null } },
    attributes: ['id', 'companyName', 'country', 'screeningStatus', 'sanctionsScreenDetails'],
  });

  for (const row of rows) {
    stats.rescreened++;

    // Respect existing manual decisions outright.
    if (hasManualOverrideMarker(row.sanctionsScreenDetails)) {
      stats.manualOverrideSkipped++;
      continue;
    }
    if (PROTECTED_STATUSES.has(row.screeningStatus)) {
      stats.alreadyProtected++;
      continue;
    }

    const screen = sanctionsService.screenName(row.companyName || '', row.country);
    if (screen.status !== 'flagged') continue;

    // Filter to jurisdiction-only hits for the audit — name-based hits
    // would have already triggered a flag pre-4.13a, so the migration
    // is here for the jurisdiction-only case.
    const jurisdictionHits = (screen.hits || []).filter(h => h && h.rule === 'jurisdiction');
    if (!jurisdictionHits.length) continue;

    const before = row.screeningStatus || 'pending';
    const existingDetails = Array.isArray(row.sanctionsScreenDetails) ? row.sanctionsScreenDetails : [];
    const mergedDetails = existingDetails.concat(jurisdictionHits);

    await row.update({
      screeningStatus: 'flagged',
      sanctionsScreenDetails: mergedDetails,
      lastScreenedAt: new Date(),
    });
    stats.statusChanged++;

    if (db.AuditLog) {
      await db.AuditLog.create({
        action: 'phase4_13a_jurisdiction_rescreen',
        entity: entityLabel,
        entityId: row.id,
        userId: null,
        changes: {
          country: row.country,
          before,
          after: 'flagged',
          jurisdictionHits,
        },
      }).catch(() => {});
    }
  }
}

async function migrate413aJurisdictionBackfill(db) {
  if (!db?.sequelize) {
    logger.warn('[phase4_13a] db unavailable; skipping');
    return { skipped: true };
  }
  if (!db.AuditLog) {
    logger.warn('[phase4_13a] AuditLog model unavailable; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { skipped: true, reason: 'sentinel-present' };
  }

  const stats = {
    rescreened: 0,
    statusChanged: 0,
    manualOverrideSkipped: 0,
    alreadyProtected: 0,
  };

  await rescreenModel(db, db.Lead, 'Lead', stats);
  await rescreenModel(db, db.Customer, 'Customer', stats);

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: stats,
  });

  logger.info(`[phase4_13a] jurisdiction backfill complete: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { migrate413aJurisdictionBackfill, SENTINEL_ACTION };
