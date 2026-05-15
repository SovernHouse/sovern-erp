/**
 * Phase 4.9.2a — Factory.brandCode + taxonomy sortOrder fix.
 *
 * Part A:
 *   - ALTER TABLE Factory ADD COLUMN brand_code (try/catch on duplicate-
 *     column race per L-046 pattern).
 *   - Backfill brand_code='FW' on Anhui HanHua + FlorWay. All other
 *     existing factories leave brand_code null. Admin can set via UI.
 *
 * Part B:
 *   - Resilient sortOrder 10 → 2 (was colliding with Bamboo at 10).
 *   - Engineered SPC 4 → 3, LVT 5 → 4, Vinyl Sheet 6 → 5 (close the
 *     gap at sortOrder 3 under Resilient; SPC stays 1, WPC stays 2).
 *
 * Idempotent via sentinel `phase4_9_2a_completed`. Per-step state checks
 * make re-runs safe even if the sentinel were stripped.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_9_2a_completed';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

async function columnExists(sequelize, table, column) {
  const [rows] = await sequelize.query(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === column);
}

async function ensureFactoryBrandCodeColumn(sequelize) {
  if (await columnExists(sequelize, 'Factory', 'brand_code')) {
    logger.info('[migrate-492a] SKIPPED Factory.brand_code (already exists)');
    return { added: false };
  }
  try {
    await sequelize.query(`ALTER TABLE Factory ADD COLUMN brand_code VARCHAR(8) DEFAULT NULL`);
    logger.info('[migrate-492a] ADDED column Factory.brand_code');
    return { added: true };
  } catch (err) {
    if (/duplicate column/i.test(err.message)) {
      logger.info('[migrate-492a] SKIPPED Factory.brand_code (duplicate on race)');
      return { added: false };
    }
    throw err;
  }
}

async function backfillFactoryBrands(db) {
  // Match by companyName per Alex's spec. LIKE patterns to forgive
  // small spelling differences (the "Anhui HanHua Building Materials
  // Technology Co., Ltd." vs "Anhui Hanhua..." kind of thing).
  const targets = [
    { likes: ['%HanHua%', '%Hanhua%', '%Han Hua%'], brand: 'FW', label: 'HanHua' },
    { likes: ['%FlorWay%', '%Florway%', '%FlorWay SDN%'], brand: 'FW', label: 'FlorWay' },
  ];
  const Factory = db.Factory;
  const { Op } = require('sequelize');
  let updated = 0;
  for (const t of targets) {
    const rows = await Factory.findAll({
      where: {
        [Op.or]: t.likes.map(pattern => ({ companyName: { [Op.like]: pattern } })),
      },
    });
    for (const row of rows) {
      if (row.brandCode === t.brand) continue;
      await row.update({ brandCode: t.brand });
      logger.info(`[migrate-492a] set brandCode=${t.brand} on "${row.companyName}"`);
      updated++;
    }
    if (rows.length === 0) {
      logger.info(`[migrate-492a] no rows matched ${t.label} (skipped backfill)`);
    }
  }
  return { updated };
}

async function fixTaxonomySortOrders(db) {
  const PC = db.ProductCategory;
  const moves = [
    { name: 'Resilient',                       newSortOrder: 2 },
    { name: 'Engineered SPC',                  newSortOrder: 3 },
    { name: 'LVT (Luxury Vinyl Tile)',         newSortOrder: 4 },
    { name: 'Vinyl Sheet',                     newSortOrder: 5 },
  ];
  let moved = 0;
  for (const m of moves) {
    const row = await PC.findOne({ where: { name: m.name } });
    if (!row) {
      logger.info(`[migrate-492a] sortOrder SKIP: "${m.name}" not found`);
      continue;
    }
    if (Number(row.sortOrder) === m.newSortOrder) continue;
    const before = row.sortOrder;
    await row.update({ sortOrder: m.newSortOrder });
    logger.info(`[migrate-492a] "${m.name}" sortOrder ${before} → ${m.newSortOrder}`);
    moved++;
  }
  return { moved };
}

async function migrate492aFactoryBrandAndTaxonomy(db) {
  if (!db?.Factory || !db?.ProductCategory || !db?.AuditLog) {
    logger.warn('[migrate-492a] required deps missing; skipping');
    return { skipped: true };
  }
  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) return { alreadyRun: true };

  const colResult = await ensureFactoryBrandCodeColumn(db.sequelize);
  const backfillResult = await backfillFactoryBrands(db);
  const sortResult = await fixTaxonomySortOrders(db);

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: {
      factoryBrandCodeColumn: colResult,
      factoryBackfill: backfillResult,
      taxonomySortOrder: sortResult,
    },
  });

  logger.info(`[migrate-492a] complete: column ${colResult.added ? 'added' : 'skip'}, ${backfillResult.updated} factory brand(s) set, ${sortResult.moved} taxonomy reordered`);
  return { colResult, backfillResult, sortResult };
}

module.exports = { migrate492aFactoryBrandAndTaxonomy, SENTINEL_ACTION };
