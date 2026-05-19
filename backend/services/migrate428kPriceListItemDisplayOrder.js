/**
 * Phase 4.28k — PriceListItem.display_order column + thickness backfill.
 *
 * 2026-05-19 Alex feedback: IronLite PriceLists rendered in lexicographic
 * SKU order: 10.0mm → 11.0mm → 12.0mm → 6.5mm → 7.0mm → 7.5mm → ...
 * because "1" sorts before "6" in ASCII. Trade convention reads
 * thinnest-to-thickest. Adding an explicit display_order column lets the
 * operator reorder via drag-and-drop AND lets the backfill solve the
 * IronLite case immediately.
 *
 * Algorithm per-list:
 *   1. Pull all PriceListItem rows for the list.
 *   2. For each row, extract a sort key:
 *      - First try to match `-(\d+\.?\d*)\s*mm\b` in sku or productName.
 *        If matched, sort key = the float thickness. Otherwise fall back
 *        to the position in `[items sorted by sku ASC]` (preserves
 *        operator intent for non-flooring lists).
 *   3. Stable-sort the rows by sort key.
 *   4. Assign display_order = 10, 20, 30, ... (10-step so manual
 *      reorder can slot a row between two without renumbering).
 *
 * Idempotent via AuditLog sentinel
 * `phase4_28k_pricelist_item_display_order_backfilled`.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_28k_pricelist_item_display_order_backfilled';

// Match `-6.5mm`, `-12mm`, `12.0mm`, etc. Anchored on space or hyphen.
const THICKNESS_RE = /(?:^|[\s\-_])(\d+(?:\.\d+)?)\s*mm\b/i;

function extractThickness(...candidates) {
  for (const s of candidates) {
    if (!s) continue;
    const m = String(s).match(THICKNESS_RE);
    if (m) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

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

async function migrate428kPriceListItemDisplayOrder(db) {
  if (!db.PriceList || !db.PriceListItem) {
    logger.info('[4.28k] PriceList model missing; skipping');
    return { skipped: true };
  }
  if (await hasSentinel(db)) {
    return { skipped: true };
  }

  const lists = await db.PriceList.findAll({ attributes: ['id', 'name'] });
  let listsTouched = 0;
  let itemsUpdated = 0;

  for (const pl of lists) {
    const items = await db.PriceListItem.findAll({
      where: { priceListId: pl.id },
      order: [['createdAt', 'ASC'], ['sku', 'ASC']],
    });
    if (items.length === 0) continue;

    // Build sort tuples: [item, sortKey, insertionFallback]
    const skuSortedIndex = new Map(
      [...items]
        .sort((a, b) => String(a.sku || '').localeCompare(String(b.sku || '')))
        .map((it, idx) => [it.id, idx])
    );
    const enriched = items.map((it) => ({
      item: it,
      thickness: extractThickness(it.sku, it.productName),
      insertionIdx: skuSortedIndex.get(it.id),
    }));

    // Decide: do at least 50% of items have a thickness signal? If yes,
    // sort by thickness; non-thickness rows go to the end ordered by sku.
    // If no, preserve sku ASC ordering across all rows.
    const withThickness = enriched.filter(e => e.thickness != null).length;
    const useThickness = withThickness >= Math.ceil(enriched.length / 2);

    enriched.sort((a, b) => {
      if (useThickness) {
        const aHas = a.thickness != null;
        const bHas = b.thickness != null;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) return a.thickness - b.thickness;
      }
      return a.insertionIdx - b.insertionIdx;
    });

    // Assign 10, 20, 30, ... so manual reorder can slot between rows.
    for (let i = 0; i < enriched.length; i++) {
      const newOrder = (i + 1) * 10;
      if (enriched[i].item.displayOrder !== newOrder) {
        await enriched[i].item.update({ displayOrder: newOrder });
        itemsUpdated++;
      }
    }
    listsTouched++;
  }

  await writeSentinel(db, {
    listsTouched,
    itemsUpdated,
    runAt: new Date().toISOString(),
  });

  logger.info(`[4.28k] PriceListItem.display_order backfilled: ${listsTouched} list(s), ${itemsUpdated} item(s)`);
  return { listsTouched, itemsUpdated };
}

module.exports = { migrate428kPriceListItemDisplayOrder, extractThickness };
