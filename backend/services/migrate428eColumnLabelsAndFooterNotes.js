/**
 * migrate428eColumnLabelsAndFooterNotes — Phase 4.28d second follow-up
 * (2026-05-17).
 *
 * Adds two columns to PriceList:
 *   1. column_labels  TEXT NULL  (DataTypes.JSON in the model)
 *      Per-PriceList override map for standard column header labels so
 *      the operator can rename "Cost Price" to "FOB", "Min Order" to
 *      "Min QTY", etc.
 *   2. footer_notes   TEXT NULL
 *      Free text rendered below the items table on the PDF (payment
 *      terms, duty breakdown, Incoterm caveat, sample policy).
 *
 * Idempotent via AuditLog sentinel
 *   phase4_28e_price_list_column_labels_footer_notes_added.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_28e_price_list_column_labels_footer_notes_added';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

async function columnExists(sequelize, table, column) {
  const [rows] = await sequelize.query(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === column);
}

async function migrate428eColumnLabelsAndFooterNotes(db) {
  if (!db?.sequelize) {
    logger.warn('[phase4_28e] sequelize unavailable; skipping');
    return { skipped: true };
  }
  if (!db.AuditLog) {
    logger.warn('[phase4_28e] AuditLog unavailable; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { skipped: true, reason: 'sentinel-present' };
  }

  const stats = { columnLabelsAdded: false, footerNotesAdded: false };

  if (!(await columnExists(db.sequelize, 'PriceList', 'column_labels'))) {
    try {
      await db.sequelize.query(
        'ALTER TABLE "PriceList" ADD COLUMN "column_labels" TEXT NULL'
      );
      stats.columnLabelsAdded = true;
      logger.info('[phase4_28e] added PriceList.column_labels');
    } catch (err) {
      logger.error(`[phase4_28e] failed to add column_labels: ${err.message}`);
      throw err;
    }
  }

  if (!(await columnExists(db.sequelize, 'PriceList', 'footer_notes'))) {
    try {
      await db.sequelize.query(
        'ALTER TABLE "PriceList" ADD COLUMN "footer_notes" TEXT NULL'
      );
      stats.footerNotesAdded = true;
      logger.info('[phase4_28e] added PriceList.footer_notes');
    } catch (err) {
      logger.error(`[phase4_28e] failed to add footer_notes: ${err.message}`);
      throw err;
    }
  }

  await db.AuditLog.create({
    action:    SENTINEL_ACTION,
    entity:    'System',
    entityId:  SYSTEM_ENTITY_ID,
    userId:    null,
    changes:   stats,
  });

  logger.info(`[phase4_28e] complete: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { migrate428eColumnLabelsAndFooterNotes, SENTINEL_ACTION };
