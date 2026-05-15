/**
 * Phase 4.5 C21 follow-up — archive every product category NOT in the
 * Flooring tree.
 *
 * C21 hid non-flooring productType enum values on the Product catalog UI
 * but did NOT touch the ProductCategory table itself. The Settings ->
 * Product Taxonomy page kept showing all 7 parent verticals + their
 * sub-categories. This migration archives the 5 non-flooring parents
 * (Garments & Fabrics, Travel Accessories, Bathroom Products, Ironmongery
 * & Hardware, Car Parts & Accessories) + every child under them. Any
 * orphan top-level row that is not Flooring (e.g. the stale "SPC" parent
 * found on prod 2026-05-15) also gets archived.
 *
 * Idempotent via AuditLog sentinel `phase4_5_c21_followup_taxonomy_archived`.
 * Re-running is a no-op. Future fresh installs come up with the same
 * archived state because the seed only inserts missing rows and the
 * migration runs at boot.
 *
 * Schema: ProductCategory.isArchived column is added by
 * sequelize.sync({ alter: true }) on boot before this migration runs.
 */

const { Op } = require('sequelize');
const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_5_c21_followup_taxonomy_archived';

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

async function migrateArchiveTaxonomyC21Followup(db) {
  if (!db.ProductCategory) {
    logger.info('[C21 follow-up] ProductCategory model missing; skipping');
    return { skipped: true };
  }
  if (await hasSentinel(db)) {
    return { skipped: true };
  }

  // Locate the Flooring parent. Match on slug='flooring' first (canonical),
  // fall back to lowercased name match for any legacy variants.
  const flooring = await db.ProductCategory.findOne({
    where: {
      parentId: null,
      [Op.or]: [{ slug: 'flooring' }, { name: 'Flooring' }],
    },
  });

  if (!flooring) {
    logger.warn('[C21 follow-up] No Flooring parent row found; nothing to anchor on. Skipping.');
    await writeSentinel(db, { skipped: true, reason: 'no_flooring_parent' });
    return { skipped: true, reason: 'no_flooring_parent' };
  }

  // Anything to KEEP unarchived: Flooring itself + its direct children.
  const keepIds = new Set([flooring.id]);
  const flooringChildren = await db.ProductCategory.findAll({
    where: { parentId: flooring.id },
    attributes: ['id'],
  });
  for (const c of flooringChildren) keepIds.add(c.id);

  // Archive everything else. Use raw IN clause for the keep list so the
  // UPDATE is a single statement.
  const allIds = (await db.ProductCategory.findAll({ attributes: ['id'], raw: true })).map((r) => r.id);
  const archiveIds = allIds.filter((id) => !keepIds.has(id));

  if (archiveIds.length === 0) {
    await writeSentinel(db, { archived: 0, kept: keepIds.size, runAt: new Date().toISOString() });
    return { archived: 0, kept: keepIds.size };
  }

  await db.ProductCategory.update(
    { isArchived: true },
    { where: { id: { [Op.in]: archiveIds } } },
  );

  await writeSentinel(db, {
    archived: archiveIds.length,
    kept: keepIds.size,
    flooringId: flooring.id,
    flooringChildCount: flooringChildren.length,
    runAt: new Date().toISOString(),
  });

  logger.info(`[C21 follow-up] Archived ${archiveIds.length} non-flooring categories; kept ${keepIds.size} flooring rows`);
  return { archived: archiveIds.length, kept: keepIds.size };
}

module.exports = { migrateArchiveTaxonomyC21Followup };
