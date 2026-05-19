// Phase 4.28k — PriceListItem.displayOrder backfill via thickness extraction.
//
// 2026-05-19: SKU-ASCII sort surfaced IronLite 10.0mm before 6.5mm on the
// rendered PDF because lexicographic "1" < "6". Backfill must extract
// thickness from the SKU pattern -N.NNmm and assign displayOrder
// thinnest-first (10, 20, 30, ...).
//
// What this test asserts:
//   1. extractThickness pulls a sane float from IronLite SKUs.
//   2. Migration assigns displayOrder thinnest-first when >=50% of items
//      match the thickness pattern.
//   3. Non-flooring lists fall back to sku ASC ordering.
//   4. Migration is idempotent (sentinel-guarded).

const { v4: uuidv4 } = require('uuid');
const {
  migrate428kPriceListItemDisplayOrder,
  extractThickness,
} = require('../../services/migrate428kPriceListItemDisplayOrder');

describe('Phase 4.28k — display_order thickness backfill', () => {
  let db;
  let flooringListId;
  let genericListId;

  beforeAll(async () => {
    db = require('../../models');
    await db.sequelize.sync({ force: true });
    await db.sequelize.query('PRAGMA foreign_keys = OFF');

    const cat = await db.ProductCategory.create({
      id: uuidv4(), name: 'Engineered SPC', slug: 'engineered-spc', defaultBrand: 'FW',
    });
    const fac = await db.Factory.create({
      id: uuidv4(), companyName: 'FlorWay (test)', email: 'fw@test.example',
      phone: '+60-test', brandCode: 'FW',
    });

    // Flooring list — 9 IronLite SKUs in random order. Expect thickness sort.
    flooringListId = uuidv4();
    await db.PriceList.create({
      id: flooringListId, name: 'IronLite test', currencyCode: 'USD',
      brandCode: 'FW', isActive: true, factoryId: fac.id,
    });
    const thicknesses = [10.0, 6.5, 12.0, 7.0, 9.0, 7.5, 11.0, 8.5, 8.0];
    for (const t of thicknesses) {
      await db.PriceListItem.create({
        id: uuidv4(),
        priceListId: flooringListId,
        sku: `IL-180x1220-${t.toFixed(1)}mm`,
        productName: `IronLite Core ${t.toFixed(1)}mm Engineered SPC`,
        sellingPrice: 10.0,
        unit: 'sqm',
      });
    }

    // Generic list — sku-only, no thickness pattern. Expect sku ASC.
    genericListId = uuidv4();
    await db.PriceList.create({
      id: genericListId, name: 'Hardware test', currencyCode: 'USD',
      brandCode: 'SH', isActive: true,
    });
    for (const sku of ['HW-Z9', 'HW-A1', 'HW-M5']) {
      await db.PriceListItem.create({
        id: uuidv4(),
        priceListId: genericListId,
        sku,
        productName: `Hardware ${sku}`,
        sellingPrice: 5.0,
        unit: 'piece',
      });
    }
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('extractThickness pulls float from IronLite SKU + productName', () => {
    expect(extractThickness('IL-180x1220-6.5mm')).toBe(6.5);
    expect(extractThickness('IL-180x1220-12.0mm')).toBe(12.0);
    expect(extractThickness(null, '8.5mm Engineered SPC')).toBe(8.5);
    expect(extractThickness('  10mm vinyl ')).toBe(10);
    expect(extractThickness('HW-A1')).toBeNull();
    expect(extractThickness(null, null)).toBeNull();
  });

  test('first run reorders the flooring list thinnest-first; idempotent on second', async () => {
    const r1 = await migrate428kPriceListItemDisplayOrder(db);
    expect(r1.listsTouched).toBeGreaterThanOrEqual(1);
    expect(r1.itemsUpdated).toBe(12); // 9 IL + 3 HW

    const r2 = await migrate428kPriceListItemDisplayOrder(db);
    expect(r2.skipped).toBe(true);
  });

  test('IronLite items now ordered 6.5 → 12.0 by displayOrder', async () => {
    const rows = await db.PriceListItem.findAll({
      where: { priceListId: flooringListId },
      order: [['displayOrder', 'ASC']],
      attributes: ['sku', 'displayOrder'],
    });
    const skus = rows.map(r => r.sku);
    expect(skus).toEqual([
      'IL-180x1220-6.5mm',
      'IL-180x1220-7.0mm',
      'IL-180x1220-7.5mm',
      'IL-180x1220-8.0mm',
      'IL-180x1220-8.5mm',
      'IL-180x1220-9.0mm',
      'IL-180x1220-10.0mm',
      'IL-180x1220-11.0mm',
      'IL-180x1220-12.0mm',
    ]);
    expect(rows.map(r => r.displayOrder)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  test('generic non-flooring list falls back to sku ASC', async () => {
    const rows = await db.PriceListItem.findAll({
      where: { priceListId: genericListId },
      order: [['displayOrder', 'ASC']],
      attributes: ['sku', 'displayOrder'],
    });
    expect(rows.map(r => r.sku)).toEqual(['HW-A1', 'HW-M5', 'HW-Z9']);
  });
});
