/**
 * Phase 4.5, C20 — Archival cleanup of pre-populated seed data.
 *
 * Sovern's live DB has 31 demo Products + 31 paired ProductPrice rows +
 * 1 ProductSpecification row, plus empty Quotation/SalesOrder/ProformaInvoice
 * /Invoice/PurchaseOrder/CommissionTracking tables. None of those are real
 * trade data Alex created — they're seeded for testing. This migration
 * archives them all to ArchivedSeed_<Table> mirrors then clears the source
 * tables so the catalog reads clean.
 *
 * Recoverable: the original rows survive in ArchivedSeed_* tables with an
 * archived_at_utc column. To restore, INSERT back into the source from the
 * archive.
 *
 * Idempotent via AuditLog sentinel `phase4_5_seed_data_archived`. After the
 * sentinel exists, the migration is a no-op on every subsequent boot.
 *
 * KEEP UNTOUCHED (per the C20 brief):
 *   - real Customer / Lead rows (anything Alex created himself)
 *   - Brand configs, productType enum, certifications enum
 *   - User accounts
 *   - AuditLog history (only ever appended to)
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_5_seed_data_archived';

// Tables to archive. Order matters: children before parents so the DELETE
// at the end doesn't trip CASCADE references.
const TARGETS = [
  // Children of Product:
  { source: 'ProductPrice',         archive: 'ArchivedSeed_ProductPrice' },
  { source: 'ProductSpecification', archive: 'ArchivedSeed_ProductSpecification' },
  // Parent:
  { source: 'Product',              archive: 'ArchivedSeed_Product' },
  // Independently-targeted (all empty per pre-check, included for symmetry
  // and to scaffold the archive tables in case rows arrive later before
  // the next phase):
  { source: 'CommissionTracking',   archive: 'ArchivedSeed_CommissionTracking' },
  { source: 'PurchaseOrder',        archive: 'ArchivedSeed_PurchaseOrder' },
  { source: 'Invoice',              archive: 'ArchivedSeed_Invoice' },
  { source: 'ProformaInvoice',      archive: 'ArchivedSeed_ProformaInvoice' },
  { source: 'SalesOrder',           archive: 'ArchivedSeed_SalesOrder' },
  { source: 'Quotation',            archive: 'ArchivedSeed_Quotation' },
];

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

async function countRows(db, table) {
  const [rows] = await db.sequelize.query(`SELECT COUNT(*) AS n FROM "${table}"`);
  return rows[0]?.n || 0;
}

async function archiveOne(db, source, archive) {
  // sqlite "CREATE TABLE AS SELECT" copies schema (sans constraints) + rows.
  // Adding archived_at_utc on the select gives us a per-row timestamp.
  // DROP-then-CREATE is fine because we're sentinel-guarded against re-runs.
  await db.sequelize.query(`DROP TABLE IF EXISTS "${archive}"`);
  await db.sequelize.query(
    `CREATE TABLE "${archive}" AS SELECT *, datetime('now') AS archived_at_utc FROM "${source}"`,
  );
  const archived = await countRows(db, archive);
  // Now clear the source. Children of Product go first (ProductPrice +
  // ProductSpecification); Product itself goes after, so the FK on those
  // children is already gone.
  await db.sequelize.query(`DELETE FROM "${source}"`);
  return archived;
}

async function migrateSeedDataC20(db) {
  if (!db.sequelize) {
    logger.info('[C20] sequelize handle missing; skipping');
    return { skipped: true };
  }
  if (await hasSentinel(db)) {
    return { skipped: true };
  }

  const before = {};
  for (const t of TARGETS) {
    before[t.source] = await countRows(db, t.source);
  }

  const archived = {};
  for (const t of TARGETS) {
    try {
      archived[t.source] = await archiveOne(db, t.source, t.archive);
    } catch (e) {
      logger.warn(`[C20] archive ${t.source} -> ${t.archive} failed: ${e.message}`);
      archived[t.source] = { error: e.message };
    }
  }

  await writeSentinel(db, {
    targets: TARGETS.map(t => t.source),
    rowCounts: before,
    archived,
    note: 'Archival is recoverable. To restore a table: INSERT INTO <Source> SELECT (all columns except archived_at_utc) FROM ArchivedSeed_<Source>.',
    runAt: new Date().toISOString(),
  });

  logger.info(`[C20] Seed data archived: ${Object.entries(before).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  return { archived, before };
}

module.exports = { migrateSeedDataC20, SENTINEL_ACTION };
