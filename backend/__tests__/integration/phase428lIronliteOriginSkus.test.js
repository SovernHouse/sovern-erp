// Phase 4.28l — IronLite SKU split into ILMY-* (Malaysia / FW) and
// ILCN-* (China / HH).
//
// 2026-05-19: Alex wants SKUs to convey origin. Same physical board
// gets two catalog entries — one per factory line. Migration:
//   - renames the existing 9 IL- Products to ILCN-*, flips brand to HH,
//     sets origin to China, baseFobPrice to the China supplier price
//   - creates 9 new ILMY-* Products with brand FW, origin Malaysia,
//     baseFobPrice = Malaysia supplier price
//   - repoints PriceList items on the FW (Malaysia) list to the new
//     ILMY products, sku updated to ILMY-*
//   - repoints PriceList items on the HH (China) list to the renamed
//     ILCN products, sku updated to ILCN-*

const { v4: uuidv4 } = require('uuid');
const {
  migrate428lIronliteOriginSkus,
  THICKNESSES, OLD_SKU, CN_SKU, MY_SKU, IRONLITE_PRICES,
} = require('../../services/migrate428lIronliteOriginSkus');

describe('Phase 4.28l — IronLite origin-specific SKU split', () => {
  let db;
  const FW_PRICE_LIST = '23a0e6e7-912d-4dc7-9155-be30f9c9384e';
  const HH_PRICE_LIST = 'c49dee71-fbb6-4552-97a6-a4be1571be0b';
  const oldProductIds = {};

  beforeAll(async () => {
    db = require('../../models');
    await db.sequelize.sync({ force: true });
    await db.sequelize.query('PRAGMA foreign_keys = OFF');

    const cat = await db.ProductCategory.create({
      id: uuidv4(), name: 'Engineered SPC', slug: 'engineered-spc', defaultBrand: 'FW',
    });
    const fwFac = await db.Factory.create({
      id: uuidv4(), companyName: 'FlorWay (test)', email: 'fw@test.example',
      phone: '+60-test', brandCode: 'FW',
    });
    const hhFac = await db.Factory.create({
      id: uuidv4(), companyName: 'HanHua (test)', email: 'hh@test.example',
      phone: '+86-test', brandCode: 'HH',
    });

    // Seed 9 IronLite Products with the pre-4.28l shape: IL-* SKUs,
    // brand_code='FW', origin='China', originVariants carrying both.
    for (const t of THICKNESSES) {
      const p = await db.Product.create({
        id: uuidv4(),
        sku: OLD_SKU(t),
        name: `IronLite Core ${t}mm Engineered SPC`,
        brandCode: 'FW',
        productType: 'engineered_spc',
        categoryId: cat.id,
        factoryId: fwFac.id,
        originCountry: 'China',
        baseFobPrice: IRONLITE_PRICES[t].CN,
        currency: 'USD',
        originVariants: [
          { originCountry: 'CN', fobPriceUsd: IRONLITE_PRICES[t].CN, priceUnit: 'sqm' },
          { originCountry: 'MY', fobPriceUsd: IRONLITE_PRICES[t].MY, priceUnit: 'sqm' },
        ],
      });
      oldProductIds[t] = p.id;
    }

    // Seed the two PriceLists with items pointing at the IL- Products.
    await db.PriceList.create({
      id: FW_PRICE_LIST, name: 'FW Malaysia', currencyCode: 'USD',
      brandCode: 'FW', isActive: true, factoryId: fwFac.id,
    });
    await db.PriceList.create({
      id: HH_PRICE_LIST, name: 'HH China', currencyCode: 'USD',
      brandCode: 'HH', isActive: true, factoryId: hhFac.id,
    });
    for (const t of THICKNESSES) {
      for (const listId of [FW_PRICE_LIST, HH_PRICE_LIST]) {
        const isMY = listId === FW_PRICE_LIST;
        await db.PriceListItem.create({
          id: uuidv4(),
          priceListId: listId,
          productId: oldProductIds[t],
          sku: OLD_SKU(t),
          productName: `IronLite Core ${t}mm Engineered SPC`,
          sellingPrice: isMY ? IRONLITE_PRICES[t].MY : IRONLITE_PRICES[t].CN,
          unit: 'sqm',
        });
      }
    }
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('runs on first call, idempotent on second', async () => {
    const r1 = await migrate428lIronliteOriginSkus(db);
    expect(r1.renamed).toBe(9);
    expect(r1.created).toBe(9);
    expect(r1.fwItemsRepointed).toBe(9);
    expect(r1.hhItemsRepointed).toBe(9);

    const r2 = await migrate428lIronliteOriginSkus(db);
    expect(r2.skipped).toBe(true);
  });

  test('each thickness now has an ILCN-* Product (HH brand, China origin, China price)', async () => {
    for (const t of THICKNESSES) {
      const p = await db.Product.findOne({ where: { sku: CN_SKU(t) } });
      expect(p).toBeTruthy();
      expect(p.brandCode).toBe('HH');
      expect(p.originCountry).toBe('China');
      expect(Number(p.baseFobPrice)).toBeCloseTo(IRONLITE_PRICES[t].CN, 3);
      expect(p.originVariants.length).toBe(1);
      expect(p.originVariants[0].originCountry).toBe('CN');
    }
  });

  test('each thickness now has an ILMY-* Product (FW brand, Malaysia origin, Malaysia price)', async () => {
    for (const t of THICKNESSES) {
      const p = await db.Product.findOne({ where: { sku: MY_SKU(t) } });
      expect(p).toBeTruthy();
      expect(p.brandCode).toBe('FW');
      expect(p.originCountry).toBe('Malaysia');
      expect(Number(p.baseFobPrice)).toBeCloseTo(IRONLITE_PRICES[t].MY, 3);
      expect(p.originVariants.length).toBe(1);
      expect(p.originVariants[0].originCountry).toBe('MY');
    }
  });

  test('FW PriceList items now show ILMY-* SKUs', async () => {
    // 4.28o: '(Malaysia)' / '(China)' suffix dropped from product names
    // — origin is encoded in the SKU prefix, the parenthetical was
    // redundant. Just assert the SKU pattern + that the name is non-empty.
    const items = await db.PriceListItem.findAll({ where: { priceListId: FW_PRICE_LIST } });
    expect(items.length).toBe(9);
    for (const it of items) {
      expect(it.sku).toMatch(/^ILMY-180x1220-\d+(\.\d+)?mm$/);
      expect(it.productName).toMatch(/IronLite Core/);
    }
  });

  test('HH PriceList items now show ILCN-* SKUs', async () => {
    const items = await db.PriceListItem.findAll({ where: { priceListId: HH_PRICE_LIST } });
    expect(items.length).toBe(9);
    for (const it of items) {
      expect(it.sku).toMatch(/^ILCN-180x1220-\d+(\.\d+)?mm$/);
      expect(it.productName).toMatch(/IronLite Core/);
    }
  });

  test('no IL-* (origin-less) SKUs remain on Products or PriceListItems', async () => {
    const oldProds = await db.Product.findAll({ where: { sku: { [require('sequelize').Op.like]: 'IL-180x1220%' } } });
    expect(oldProds.length).toBe(0);
    const oldItems = await db.PriceListItem.findAll({ where: { sku: { [require('sequelize').Op.like]: 'IL-180x1220%' } } });
    expect(oldItems.length).toBe(0);
  });
});
