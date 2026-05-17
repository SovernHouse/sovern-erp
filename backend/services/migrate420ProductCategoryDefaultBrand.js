/**
 * migrate420ProductCategoryDefaultBrand — Phase 4.20 (Bug 4b).
 *
 * Adds the ProductCategory.default_brand column (STRING(8), nullable) and
 * backfills 'FW' for the Resilient flooring subtree:
 *   - Resilient (parent)
 *   - LVT (Luxury Vinyl Tile)
 *   - SPC (Stone Plastic Composite)
 *   - Engineered SPC
 *   - WPC (Wood Plastic Composite)
 *   - Vinyl Sheet
 *
 * Downstream: ProductCatalog.jsx prefills form.brandCode='FW' when one of
 * these categories is picked on a NEW product. create_product MCP handler
 * applies the same rule server-side. Either side can be overridden.
 *
 * Idempotent via AuditLog sentinel `phase4_20_product_category_default_brand`.
 * PRAGMA + slug lookups double as safety nets if the sentinel is wiped.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_20_product_category_default_brand';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

// Slugs that should default to FW. Matches the Resilient subtree per the
// 2026-05-15 taxonomy snapshot. Add new slugs here if FlorWay absorbs more
// flooring lines.
const FW_SLUGS = ['resilient', 'lvt', 'spc', 'engineered-spc', 'wpc', 'vinyl-sheet'];

async function columnExists(sequelize, table, column) {
  const [rows] = await sequelize.query(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === column);
}

async function migrate420ProductCategoryDefaultBrand(db) {
  if (!db?.sequelize) {
    logger.warn('[phase4_20] sequelize unavailable; skipping');
    return { skipped: true };
  }
  if (!db.AuditLog) {
    logger.warn('[phase4_20] AuditLog unavailable; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { skipped: true, reason: 'sentinel-present' };
  }

  const stats = { columnAdded: false, rowsTagged: 0 };

  const exists = await columnExists(db.sequelize, 'ProductCategories', 'default_brand');
  if (!exists) {
    try {
      await db.sequelize.query(
        'ALTER TABLE "ProductCategories" ADD COLUMN "default_brand" TEXT NULL'
      );
      stats.columnAdded = true;
      logger.info('[phase4_20] added ProductCategories.default_brand');
    } catch (err) {
      logger.error(`[phase4_20] failed to add ProductCategories.default_brand: ${err.message}`);
      throw err;
    }
  }

  // Backfill via direct SQL so it works whether or not the model has
  // reloaded after the ALTER (no Sequelize ORM dependency on the new
  // column).
  const placeholders = FW_SLUGS.map(() => '?').join(', ');
  const [result] = await db.sequelize.query(
    `UPDATE "ProductCategories"
       SET "default_brand" = 'FW'
     WHERE "slug" IN (${placeholders})
       AND ("default_brand" IS NULL OR "default_brand" = '')`,
    { replacements: FW_SLUGS }
  );
  // Sequelize SQLite returns metadata in different shapes depending on
  // driver — try both. Worst case rowsTagged stays 0 but the UPDATE ran.
  stats.rowsTagged = (result && (result.changes ?? result.affectedRows ?? result.rowCount)) || 0;

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: stats,
  });

  logger.info(`[phase4_20] complete: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { migrate420ProductCategoryDefaultBrand, SENTINEL_ACTION };
