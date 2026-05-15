/**
 * Phase 4.9.3 (final) Part G — ProductPrice column cleanup.
 *
 * The 4.9.2b migration added the new temporal-pricing columns ALONGSIDE
 * the legacy ones instead of replacing the schema (the rename-and-
 * recreate path was skipped because cost_price_usd_per_m2 was already
 * present from a prior sync() run). Net effect on prod today: 22
 * columns, 0 rows, and the legacy NOT NULL constraints on cost_price /
 * selling_price / factory_id / valid_from prevent any insert that
 * uses only the new columns.
 *
 * This migration:
 *   1. Verifies prod has 0 rows (precondition; abort otherwise — we
 *      do NOT silently rewrite a populated table).
 *   2. Creates a new ProductPrice_new table with EXACTLY the target
 *      shape (clean 4.9.2b spec — factoryId NULLABLE, no legacy
 *      columns).
 *   3. Copies rows (no-op when 0).
 *   4. Drops old ProductPrice + renames ProductPrice_new → ProductPrice.
 *   5. Recreates indexes.
 *
 * All inside a transaction; either everything lands or nothing does.
 *
 * Idempotent via sentinel `phase4_9_3_g_product_price_cleanup`. Also
 * checks at start: if the legacy column `cost_price` is absent, the
 * cleanup already ran — skip.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_9_3_g_product_price_cleanup';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

const NEW_TABLE_SQL = `
CREATE TABLE ProductPrice_new (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL REFERENCES Product(id),
  factory_id VARCHAR(36) REFERENCES Factory(id),
  origin VARCHAR(255),
  cost_price_usd_per_m2 DECIMAL(10,4) NOT NULL,
  selling_price_usd_per_m2 DECIMAL(10,4),
  markup_percent DECIMAL(5,4),
  currency VARCHAR(255) DEFAULT 'USD',
  tariff_rate DECIMAL(5,4),
  tariff_destination VARCHAR(255),
  valid_from DATE NOT NULL,
  valid_to DATE,
  source_note TEXT,
  created_by VARCHAR(36),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
)
`;

const INDEX_SQL = [
  `CREATE INDEX product_prices_product_id_origin_valid_from ON ProductPrice (product_id, origin, valid_from)`,
  `CREATE INDEX product_prices_product_id_factory_id_valid_from ON ProductPrice (product_id, factory_id, valid_from)`,
  `CREATE INDEX product_prices_valid_to ON ProductPrice (valid_to)`,
];

async function tableExists(sequelize, name) {
  const [rows] = await sequelize.query(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = :name`,
    { replacements: { name } },
  );
  return rows.length > 0;
}

async function columnExists(sequelize, table, column) {
  const [rows] = await sequelize.query(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === column);
}

async function migrate493ProductPriceCleanup(db) {
  if (!db?.AuditLog || !db.sequelize) {
    logger.warn('[cleanup-493g] required deps missing; skipping');
    return { skipped: true };
  }
  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) return { alreadyRun: true };

  // Idempotency check 2: if cost_price is already gone, the cleanup
  // ran. Record the sentinel and bail.
  if (!(await tableExists(db.sequelize, 'ProductPrice'))) {
    logger.warn('[cleanup-493g] ProductPrice table missing; nothing to clean');
    return { skipped: 'no table' };
  }
  if (!(await columnExists(db.sequelize, 'ProductPrice', 'cost_price'))) {
    logger.info('[cleanup-493g] SKIPPED — legacy cost_price column absent; schema already clean');
    await db.AuditLog.create({
      action: SENTINEL_ACTION,
      entity: 'System',
      entityId: SYSTEM_ENTITY_ID,
      userId: null,
      changes: { skipped: 'already clean' },
    });
    return { skipped: 'already clean' };
  }

  // Hard precondition: refuse to silently rewrite a populated table.
  // 0 rows on prod was verified before writing this migration; if
  // someone's running this against a DB that grew rows since, bail
  // loud so we can manually pick the right approach.
  const [countRows] = await db.sequelize.query('SELECT COUNT(*) AS n FROM ProductPrice');
  const rowCount = Number(countRows[0]?.n ?? 0);
  if (rowCount > 0) {
    throw new Error(`[cleanup-493g] ABORT: ProductPrice has ${rowCount} row(s). Migration assumes 0 rows. Manually migrate the data first OR delete the rows if they're test data; then re-run.`);
  }

  // Belt-and-braces: rename ProductPrice_new out of the way if a prior
  // failed run left it. Same for an old-pattern artifact.
  if (await tableExists(db.sequelize, 'ProductPrice_new')) {
    await db.sequelize.query('DROP TABLE ProductPrice_new');
    logger.info('[cleanup-493g] dropped leftover ProductPrice_new from a prior failed run');
  }

  // Wrap the rebuild in a transaction. If anything throws, the legacy
  // table stays intact.
  const t = await db.sequelize.transaction();
  try {
    await db.sequelize.query(NEW_TABLE_SQL, { transaction: t });
    logger.info('[cleanup-493g] CREATED ProductPrice_new with clean schema');
    // No rows to copy (rowCount=0 verified above).
    await db.sequelize.query('DROP TABLE ProductPrice', { transaction: t });
    logger.info('[cleanup-493g] DROPPED legacy ProductPrice (0 rows)');
    await db.sequelize.query('ALTER TABLE ProductPrice_new RENAME TO ProductPrice', { transaction: t });
    logger.info('[cleanup-493g] RENAMED ProductPrice_new → ProductPrice');
    for (const ixSql of INDEX_SQL) {
      try {
        await db.sequelize.query(ixSql, { transaction: t });
      } catch (e) {
        if (!/already exists/i.test(e.message)) throw e;
      }
    }
    await t.commit();
  } catch (err) {
    await t.rollback();
    logger.error('[cleanup-493g] rebuild failed; legacy table preserved:', err.message);
    throw err;
  }

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: {
      cleaned: true,
      droppedColumns: ['cost_price', 'markup', 'selling_price', 'exw_price', 'price_type', 'is_active'],
      keptColumns: ['id', 'product_id', 'factory_id (nullable now)', 'origin', 'cost_price_usd_per_m2',
        'selling_price_usd_per_m2', 'markup_percent', 'currency', 'tariff_rate', 'tariff_destination',
        'valid_from', 'valid_to', 'source_note', 'created_by', 'created_at', 'updated_at'],
      preservedRowCount: 0,
    },
  });
  logger.info('[cleanup-493g] complete: legacy columns dropped; factory_id is now nullable');
  return { cleaned: true };
}

module.exports = { migrate493ProductPriceCleanup, SENTINEL_ACTION };
