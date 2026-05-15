/**
 * Phase 4.9.2b — ProductPrice schema replacement + backfill.
 *
 * The pre-existing ProductPrice (factoryId REQUIRED, costPrice/
 * sellingPrice/markup/exwPrice/priceType columns) is replaced with a
 * temporal-pricing shape per the amended spec (factoryId nullable,
 * origin STRING nullable, USD-per-m² explicit, tariff snapshot fields,
 * sourceNote, createdBy). At least one of factoryId or origin must
 * be set on every row.
 *
 * Migration sequence:
 *   1. Sentinel guard. Re-runs are no-op.
 *   2. If old ProductPrice table exists with the legacy shape, rename
 *      it to ProductPrice_legacy_20260515 (preserves 0 rows on prod;
 *      makes intent visible per the orphan-rename pattern).
 *   3. CREATE TABLE ProductPrice with the new shape, indexes, FKs.
 *      Raw SQL because boot-time sync({alter:true}) is not reliable
 *      per L-046; future commits will migrate to a proper framework.
 *   4. Backfill: for every Product with baseFobPrice non-null, insert
 *      a single ProductPrice row capturing the current effective
 *      price. Origin derived from Product.originVariants[0] or
 *      Product.originCountry. validFrom = today.
 *   5. Sentinel write with the L-049 zero-UUID convention.
 */

const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const SENTINEL_ACTION = 'phase4_9_2b_product_price_replaced';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

const LEGACY_NAME = 'ProductPrice_legacy_20260515';
const TARGET_NAME = 'ProductPrice';

const NEW_TABLE_SQL = `
CREATE TABLE ${TARGET_NAME} (
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

const INDEXES_SQL = [
  `CREATE INDEX product_prices_product_id_origin_valid_from ON ${TARGET_NAME} (product_id, origin, valid_from)`,
  `CREATE INDEX product_prices_product_id_factory_id_valid_from ON ${TARGET_NAME} (product_id, factory_id, valid_from)`,
  `CREATE INDEX product_prices_valid_to ON ${TARGET_NAME} (valid_to)`,
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

async function backfillFromProducts(db) {
  // Read every Product. Skip those without baseFobPrice. Insert one
  // ProductPrice row capturing the current snapshot. Origin derived
  // from originVariants[0].originCountry or originCountry. If both
  // null, leave origin null (factoryId stays null too — would violate
  // the at-least-one-must-be-set rule, so SKIP those rows).
  const products = await db.Product.findAll({
    attributes: ['id', 'baseFobPrice', 'originCountry', 'originVariants', 'currency'],
  });
  let inserted = 0;
  let skippedNoPrice = 0;
  let skippedNoOriginOrFactory = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const p of products) {
    if (p.baseFobPrice == null) {
      skippedNoPrice++;
      continue;
    }
    const variantsRaw = Array.isArray(p.originVariants) ? p.originVariants : [];
    // If the product has multiple origin variants, capture each as its
    // own ProductPrice row so per-origin lookup works.
    const rowsToInsert = [];
    if (variantsRaw.length > 0) {
      for (const v of variantsRaw) {
        if (!v.originCountry && !v.factoryId) continue;
        rowsToInsert.push({
          productId: p.id,
          factoryId: v.factoryId || null,
          origin: v.originCountry || null,
          costPriceUsdPerM2: Number(v.fobPriceUsd != null ? v.fobPriceUsd : p.baseFobPrice),
          sellingPriceUsdPerM2: Number(v.fobPriceUsd != null ? v.fobPriceUsd : p.baseFobPrice),
          currency: p.currency || 'USD',
          validFrom: today,
          sourceNote: 'Phase 4.9.2b backfill from Product.originVariants',
        });
      }
    }
    if (rowsToInsert.length === 0) {
      const origin = (p.originCountry || '').trim() || null;
      if (!origin) {
        skippedNoOriginOrFactory++;
        continue;
      }
      rowsToInsert.push({
        productId: p.id,
        factoryId: null,
        origin,
        costPriceUsdPerM2: Number(p.baseFobPrice),
        sellingPriceUsdPerM2: Number(p.baseFobPrice),
        currency: p.currency || 'USD',
        validFrom: today,
        sourceNote: 'Phase 4.9.2b backfill from Product.baseFobPrice',
      });
    }
    for (const row of rowsToInsert) {
      await db.ProductPrice.create({ id: uuidv4(), ...row });
      inserted++;
    }
  }
  return { inserted, skippedNoPrice, skippedNoOriginOrFactory };
}

async function migrate492bProductPrice(db) {
  if (!db?.ProductPrice || !db?.Product || !db?.AuditLog || !db.sequelize) {
    logger.warn('[migrate-492b] required deps missing; skipping');
    return { skipped: true };
  }
  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) return { alreadyRun: true };

  const sourceExists = await tableExists(db.sequelize, TARGET_NAME);
  const isNewShape = sourceExists && (await columnExists(db.sequelize, TARGET_NAME, 'cost_price_usd_per_m2'));

  let renamed = false;
  if (sourceExists && !isNewShape) {
    // Rename existing legacy table out of the way.
    const legacyTaken = await tableExists(db.sequelize, LEGACY_NAME);
    if (legacyTaken) {
      logger.info(`[migrate-492b] ${LEGACY_NAME} already exists; dropping old ${TARGET_NAME} (legacy archive already kept)`);
      await db.sequelize.query(`DROP TABLE ${TARGET_NAME}`);
    } else {
      await db.sequelize.query(`ALTER TABLE ${TARGET_NAME} RENAME TO ${LEGACY_NAME}`);
      logger.info(`[migrate-492b] RENAMED ${TARGET_NAME} → ${LEGACY_NAME} (legacy schema preserved)`);
      renamed = true;
    }
  }

  let created = false;
  const targetExists = await tableExists(db.sequelize, TARGET_NAME);
  if (!targetExists) {
    await db.sequelize.query(NEW_TABLE_SQL);
    for (const ix of INDEXES_SQL) {
      try { await db.sequelize.query(ix); } catch (e) {
        if (!/already exists/i.test(e.message)) throw e;
      }
    }
    created = true;
    logger.info(`[migrate-492b] CREATED ${TARGET_NAME} with new schema + indexes`);
  } else if (isNewShape) {
    logger.info(`[migrate-492b] SKIPPED CREATE: ${TARGET_NAME} already on new shape`);
  }

  const backfillResult = await backfillFromProducts(db);
  logger.info(`[migrate-492b] backfill: inserted ${backfillResult.inserted}, skipped(no price) ${backfillResult.skippedNoPrice}, skipped(no origin/factory) ${backfillResult.skippedNoOriginOrFactory}`);

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: { renamed, created, backfill: backfillResult },
  });

  return { renamed, created, backfillResult };
}

module.exports = { migrate492bProductPrice, SENTINEL_ACTION, LEGACY_NAME, TARGET_NAME };
