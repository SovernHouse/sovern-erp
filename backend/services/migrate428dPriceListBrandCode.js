/**
 * migrate428dPriceListBrandCode — Phase 4.28d.
 *
 * Adds the PriceList.brand_code column and backfills existing rows by
 * inferring the brand from (in priority order):
 *   1. Factory.brand_code if factoryId is set
 *   2. The mode brand_code across the PriceList's items' Products
 *   3. Customer.brandRelationships[0] if customerId is set (LAST resort,
 *      can be 'SH' even for FW transactions per existing data; only used
 *      when items + factory carry no signal)
 *
 * Rows where no signal can be inferred are LEFT NULL and the boot log
 * shouts about them — the user (or AI assistant) must set brand_code
 * explicitly before the row can be rendered or emailed.
 *
 * Idempotent via AuditLog sentinel `phase4_28d_price_list_brand_code_added`.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_28d_price_list_brand_code_added';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

async function columnExists(sequelize, table, column) {
  const [rows] = await sequelize.query(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === column);
}

async function migrate428dPriceListBrandCode(db) {
  if (!db?.sequelize) {
    logger.warn('[phase4_28d] sequelize unavailable; skipping');
    return { skipped: true };
  }
  if (!db.AuditLog) {
    logger.warn('[phase4_28d] AuditLog unavailable; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { skipped: true, reason: 'sentinel-present' };
  }

  const stats = { columnAdded: false, rowsBackfilled: 0, rowsUnresolved: 0 };

  // 1) Add columns if missing.
  const exists = await columnExists(db.sequelize, 'PriceList', 'brand_code');
  if (!exists) {
    try {
      await db.sequelize.query(
        'ALTER TABLE "PriceList" ADD COLUMN "brand_code" TEXT NULL'
      );
      stats.columnAdded = true;
      logger.info('[phase4_28d] added PriceList.brand_code');
    } catch (err) {
      logger.error(`[phase4_28d] failed to add brand_code column: ${err.message}`);
      throw err;
    }
  }
  // hidden_columns added in the same phase (follow-up). Separate boolean
  // so the sentinel still reflects what got added on prior runs.
  const hiddenExists = await columnExists(db.sequelize, 'PriceList', 'hidden_columns');
  if (!hiddenExists) {
    try {
      await db.sequelize.query(
        'ALTER TABLE "PriceList" ADD COLUMN "hidden_columns" TEXT NULL'
      );
      stats.hiddenColumnsAdded = true;
      logger.info('[phase4_28d] added PriceList.hidden_columns');
    } catch (err) {
      logger.error(`[phase4_28d] failed to add hidden_columns column: ${err.message}`);
      // non-fatal — brand_code is the critical one
    }
  }

  // 2) Backfill from Factory.brand_code or the items' Product brand
  //    consensus. Direct SQL — avoid the model layer until the sentinel
  //    is in place.
  const [rows] = await db.sequelize.query(
    'SELECT id, customer_id, factory_id, brand_code FROM "PriceList" WHERE brand_code IS NULL OR brand_code = \'\''
  );
  for (const row of rows) {
    let inferred = null;

    if (row.factory_id) {
      const [[fac]] = await db.sequelize.query(
        'SELECT brand_code FROM "Factory" WHERE id = ?',
        { replacements: [row.factory_id] }
      ) || [[]];
      if (fac && fac.brand_code) inferred = fac.brand_code;
    }

    if (!inferred) {
      const [items] = await db.sequelize.query(
        `SELECT p.brand_code AS bc
           FROM PriceListItem pli
           LEFT JOIN Product p ON p.id = pli.product_id
          WHERE pli.price_list_id = ?
            AND p.brand_code IS NOT NULL`,
        { replacements: [row.id] }
      );
      if (Array.isArray(items) && items.length > 0) {
        const tally = {};
        for (const it of items) {
          if (it.bc) tally[it.bc] = (tally[it.bc] || 0) + 1;
        }
        const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 1) {
          inferred = sorted[0][0];
        } else if (sorted.length > 1) {
          // Mixed-brand items on a single PriceList is a data leak in waiting.
          // Refuse to backfill; the human / AI must pick the right brand
          // and either split or correct the items.
          logger.warn(`[phase4_28d] mixed-brand items on PriceList ${row.id}: ${JSON.stringify(tally)} — leaving brand_code NULL`);
        }
      }
    }

    if (!inferred && row.customer_id) {
      // Last-resort customer fallback. Customers carry brandRelationships
      // as a JSON column that may be a string on this driver (L-047);
      // parse defensively.
      const [[cust]] = await db.sequelize.query(
        'SELECT brand_relationships FROM "Customer" WHERE id = ?',
        { replacements: [row.customer_id] }
      ) || [[]];
      if (cust && cust.brand_relationships) {
        let arr = cust.brand_relationships;
        if (typeof arr === 'string') {
          try { arr = JSON.parse(arr); } catch (_) { arr = null; }
        }
        if (Array.isArray(arr) && arr.length === 1) {
          // Only auto-backfill from customer if there is exactly one
          // brand on the customer. Multi-brand customers require an
          // explicit choice.
          inferred = arr[0];
        }
      }
    }

    if (inferred) {
      await db.sequelize.query(
        'UPDATE "PriceList" SET brand_code = ? WHERE id = ?',
        { replacements: [inferred, row.id] }
      );
      stats.rowsBackfilled += 1;
      logger.info(`[phase4_28d] PriceList ${row.id} backfilled brand_code=${inferred}`);
    } else {
      stats.rowsUnresolved += 1;
      logger.warn(`[phase4_28d] PriceList ${row.id} could not be backfilled — brand_code stays NULL`);
    }
  }

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: stats,
  });

  logger.info(`[phase4_28d] complete: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { migrate428dPriceListBrandCode, SENTINEL_ACTION };
