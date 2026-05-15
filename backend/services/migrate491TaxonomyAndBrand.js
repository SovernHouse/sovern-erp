/**
 * Phase 4.9.1 — Taxonomy cleanup + brand state migration.
 *
 * Live ProductCategory table on prod is THINNER than the model (missing
 * sort_order, is_archived, slug, icon). This migration:
 *
 *   1. ALTER ADD any missing columns, with per-column added/skipped
 *      logging so the deploy log reveals whether the gap was real on
 *      this run. Wrapped per-column so a partial failure can't abort.
 *   2. Backfill nulls so the downstream UIs never blow up on a null
 *      sort_order or is_archived.
 *   3. Brand updates: HH active=false (created in error earlier this
 *      week), FW commissionRate=0.07 (HanHua Sales Rep Agreement).
 *   4. Hierarchy build: Flooring (top-level) + Resilient (child of
 *      Flooring) + re-parent existing flooring rows into the tree.
 *   5. Create the new "Engineered SPC" sub-category under
 *      Flooring → Resilient at sortOrder=4. Sibling order:
 *        Resilient: SPC Flooring=1, WPC Flooring=2, Engineered SPC=4,
 *                   LVT / Vinyl Plank=5.
 *
 * Idempotent via AuditLog sentinel
 * `phase4_9_1_taxonomy_brand_migrated`. Re-running is a no-op.
 *
 * Cleanup of the orphan rows Alex's spec named (IronCore Flooring,
 * WPC Hybrid Flooring, "duplicate SPC") is deliberately SKIPPED — none
 * of those rows exist on prod (the spec assumed a different taxonomy
 * state). Confirmed live via sqlite3 inspection before writing this
 * script. The audit log entry records the "expected rows not found"
 * outcome so the omission is visible.
 */

const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const SENTINEL_ACTION = 'phase4_9_1_taxonomy_brand_migrated';

// Slug helper. Matches the convention in the MCP tool handler so live
// rows and AI-created rows look identical.
function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

// Columns we expect on ProductCategory but that may be missing on prod
// because boot-time sync({alter:true}) evidently isn't applying.
const EXPECTED_COLUMNS = [
  { name: 'sort_order',  ddl: 'INTEGER DEFAULT 99' },
  { name: 'is_archived', ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { name: 'slug',        ddl: 'VARCHAR(255)' },
  { name: 'icon',        ddl: 'VARCHAR(255)' },
];

async function listProductCategoryColumns(sequelize) {
  const [rows] = await sequelize.query('PRAGMA table_info(ProductCategory)');
  return rows.map(r => r.name);
}

async function ensureColumn(sequelize, columnName, ddlSuffix) {
  const existing = await listProductCategoryColumns(sequelize);
  if (existing.includes(columnName)) {
    logger.info(`[migrate-491] SKIPPED ProductCategory.${columnName} (already exists)`);
    return { added: false };
  }
  try {
    await sequelize.query(`ALTER TABLE ProductCategory ADD COLUMN ${columnName} ${ddlSuffix}`);
    logger.info(`[migrate-491] ADDED column ProductCategory.${columnName}`);
    return { added: true };
  } catch (err) {
    // SQLite throws "duplicate column" if the schema raced; treat as
    // skipped rather than aborting the whole migration.
    if (/duplicate column/i.test(err.message)) {
      logger.info(`[migrate-491] SKIPPED ProductCategory.${columnName} (duplicate on race)`);
      return { added: false };
    }
    logger.error(`[migrate-491] FAILED to add ProductCategory.${columnName}: ${err.message}`);
    throw err;
  }
}

async function backfillProductCategory(db) {
  // sortOrder null → 999 so existing rows sort to the bottom predictably.
  await db.sequelize.query(`UPDATE ProductCategory SET sort_order = 999 WHERE sort_order IS NULL`);
  // isArchived NOT NULL DEFAULT 0 — SQLite will already populate; this
  // is belt-and-braces for any row that escaped the default.
  await db.sequelize.query(`UPDATE ProductCategory SET is_archived = 0 WHERE is_archived IS NULL`);
  // Slug: derive from name where null. Per-row update since slugify is JS-side.
  const allRows = await db.ProductCategory.findAll({ attributes: ['id', 'name', 'slug'] });
  let slugsBackfilled = 0;
  for (const row of allRows) {
    if (!row.slug) {
      await row.update({ slug: slugify(row.name) });
      slugsBackfilled++;
    }
  }
  logger.info(`[migrate-491] backfill: slugged ${slugsBackfilled} row(s); sortOrder/isArchived null-coalesced`);
  return { slugsBackfilled };
}

async function updateBrands(db) {
  let hhChanged = false, fwChanged = false;
  const hh = await db.Brand.findOne({ where: { code: 'HH' } });
  if (hh && hh.active === true) {
    await hh.update({ active: false });
    logger.info('[migrate-491] HH brand: active true → false');
    hhChanged = true;
  } else if (!hh) {
    logger.info('[migrate-491] HH brand: not present (skip)');
  } else {
    logger.info('[migrate-491] HH brand: already inactive (skip)');
  }
  const fw = await db.Brand.findOne({ where: { code: 'FW' } });
  if (fw && Number(fw.commissionRate) !== 0.07) {
    await fw.update({ commissionRate: 0.07 });
    logger.info(`[migrate-491] FW brand: commissionRate ${fw.commissionRate} → 0.07`);
    fwChanged = true;
  } else if (fw) {
    logger.info('[migrate-491] FW brand: commissionRate already 0.07 (skip)');
  }
  return { hhChanged, fwChanged };
}

async function buildHierarchyAndEngineeredSPC(db) {
  const PC = db.ProductCategory;

  // Helper: find by name (top-level OR child of given parent), or
  // create with the supplied attrs.
  async function findOrCreate(name, parentId, attrs = {}) {
    const where = { name, parentId: parentId || null };
    let row = await PC.findOne({ where });
    if (row) return { row, created: false };
    row = await PC.create({
      id: uuidv4(),
      name,
      slug: slugify(name),
      parentId: parentId || null,
      isActive: true,
      ...attrs,
    });
    return { row, created: true };
  }

  // 1. Flooring (top-level) and Resilient (under Flooring).
  const { row: flooring, created: flooringCreated } = await findOrCreate('Flooring', null, { sortOrder: 10, description: 'Hard-surface flooring categories.' });
  const { row: resilient, created: resilientCreated } = await findOrCreate('Resilient', flooring.id, { sortOrder: 10, description: 'Resilient flooring: SPC, WPC, LVT.' });
  logger.info(`[migrate-491] hierarchy: Flooring ${flooringCreated ? 'CREATED' : 'exists'}; Resilient ${resilientCreated ? 'CREATED' : 'exists'}`);

  // 2. Re-parent flooring orphan rows into the tree. Each is a no-op
  // when the parent is already set correctly.
  const reparentPlan = [
    { name: 'SPC Flooring',          parentId: resilient.id, sortOrder: 1 },
    { name: 'WPC Flooring',          parentId: resilient.id, sortOrder: 2 },
    { name: 'LVT / Vinyl Plank',     parentId: resilient.id, sortOrder: 5 },
    { name: 'Laminate Flooring',     parentId: flooring.id,  sortOrder: 20 },
    { name: 'Engineered Wood',       parentId: flooring.id,  sortOrder: 30 },
    { name: 'Bamboo Flooring',       parentId: flooring.id,  sortOrder: 40 },
    { name: 'Solid Wood',            parentId: flooring.id,  sortOrder: 50 },
    { name: 'WPC Decking',           parentId: flooring.id,  sortOrder: 60 },
    { name: 'Underlay & Accessories',parentId: flooring.id,  sortOrder: 70 },
  ];
  let reparented = 0;
  for (const plan of reparentPlan) {
    const row = await PC.findOne({ where: { name: plan.name } });
    if (!row) {
      logger.info(`[migrate-491] reparent SKIP: "${plan.name}" not found`);
      continue;
    }
    if (row.parentId === plan.parentId && Number(row.sortOrder) === plan.sortOrder) {
      continue; // already correct
    }
    await row.update({ parentId: plan.parentId, sortOrder: plan.sortOrder });
    reparented++;
  }
  logger.info(`[migrate-491] reparented ${reparented} flooring row(s)`);

  // 3. Create Engineered SPC at Resilient/sortOrder=4. find-or-create
  // so re-runs don't insert duplicates.
  const { row: engineeredSpc, created: engineeredSpcCreated } = await findOrCreate('Engineered SPC', resilient.id, {
    sortOrder: 4,
    description: 'Multi-layer rigid core flooring with SPC outer wear layers sandwiching a WPC middle for impact dampening. Trade-friendly term aligned with industry vocabulary.',
  });
  logger.info(`[migrate-491] Engineered SPC: ${engineeredSpcCreated ? 'CREATED' : 'exists'} (id=${engineeredSpc.id})`);

  return {
    flooringCreated, resilientCreated,
    engineeredSpcCreated, engineeredSpcId: engineeredSpc.id,
    reparented,
  };
}

async function recordSpecGaps(db) {
  // Alex's spec named rows that don't exist on prod. Record what we
  // looked for and didn't find so the audit log makes the omission
  // visible.
  const gaps = [];
  for (const name of ['IronCore Flooring', 'WPC Hybrid Flooring']) {
    const hit = await db.ProductCategory.findOne({ where: { name } });
    if (!hit) gaps.push({ name, found: false });
  }
  return { specRowsNotFound: gaps };
}

async function migrate491TaxonomyAndBrand(db) {
  if (!db?.ProductCategory || !db?.Brand || !db?.AuditLog) {
    logger.warn('[migrate-491] required models missing; skipping');
    return { skipped: true };
  }
  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { alreadyRun: true };
  }

  const schemaResult = { added: [], skipped: [] };
  for (const col of EXPECTED_COLUMNS) {
    const { added } = await ensureColumn(db.sequelize, col.name, col.ddl);
    (added ? schemaResult.added : schemaResult.skipped).push(col.name);
  }

  const backfillResult = await backfillProductCategory(db);
  const brandResult = await updateBrands(db);
  const hierarchyResult = await buildHierarchyAndEngineeredSPC(db);
  const gapResult = await recordSpecGaps(db);

  // AuditLog.entityId is NOT NULL. Use the System zero-UUID
  // convention adopted by other System-scoped sentinel writers
  // (e.g. migrateArchiveTaxonomyC21Followup.js). Passing null here
  // on first deploy threw a NotNullViolation that the boot try/catch
  // swallowed — left the sentinel missing so the guard at start of
  // this function never tripped on subsequent boots.
  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: '00000000-0000-0000-0000-000000000000',
    userId: null,
    changes: {
      schema: schemaResult,
      backfill: backfillResult,
      brands: brandResult,
      hierarchy: hierarchyResult,
      gaps: gapResult,
    },
  });

  logger.info('[migrate-491] complete');
  return { schemaResult, backfillResult, brandResult, hierarchyResult, gapResult };
}

module.exports = { migrate491TaxonomyAndBrand, SENTINEL_ACTION, slugify };
