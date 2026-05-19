// Phase 4.28f — IronLite Core per-origin price-fix migration test.
//
// 2026-05-19 incident: the AI populated both FW (Malaysia) and HH (China)
// IronLite PriceLists by reading the FlorWay HanHua Excel correctly,
// then multiplying every line by 1.07 on top — inflating every value
// by exactly the FW/HH commission rate (0.07). The system prompt
// instructed "Sovern FOB = Factory FOB / (1 - 0.05)" and the assistant
// applied that even though FW/HH supplier prices are already inclusive
// of Alex's commission (no-markup invariant codified on
// Product.baseFobPrice).
//
// What this test asserts:
//   1. Migration is idempotent (sentinel-guarded).
//   2. After migration, each IL- Product carries originVariants with the
//      canonical shape {originCountry, fobPriceUsd, priceUnit} and the
//      buyer-ready (NOT +7%) FOB for both CN and MY.
//   3. Both bad PriceLists end up isActive=false.
//   4. No Product's price is the +7%-inflated value any more.

const { v4: uuidv4 } = require('uuid');
const {
  migrate428fIronlitePricesFix,
  IRONLITE_PRICES,
  BAD_PRICE_LIST_IDS,
} = require('../../services/migrate428fIronlitePricesFix');

describe('Phase 4.28f — IronLite per-origin price fix', () => {
  let db;

  beforeAll(async () => {
    db = require('../../models');
    await db.sequelize.sync({ force: true });

    // Seed the 9 IL- Products with the corrupted shape the AI actually
    // wrote on 2026-05-17 / 2026-05-19: originVariants entries with the
    // wrong key (`origin` instead of `originCountry`) and NO fobPriceUsd.
    // baseFobPrice carries the China value × 1.07 (the inflated number
    // currently in prod). After migration we expect both to be corrected.
    const cat = await db.ProductCategory.create({
      id: uuidv4(),
      name: 'Engineered SPC',
      slug: 'engineered-spc',
      defaultBrand: 'FW',
    });
    const fac = await db.Factory.create({
      id: uuidv4(),
      companyName: 'FlorWay SDN. BHD. (test)',
      email: 'test@florway.example',
      phone: '+60-test',
      brandCode: 'FW',
    });
    const facHH = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Anhui HanHua (test)',
      email: 'test@hanhua.example',
      phone: '+86-test',
      brandCode: 'HH',
    });

    for (const sku of Object.keys(IRONLITE_PRICES)) {
      const inflated = IRONLITE_PRICES[sku].CN * 1.07; // the pre-fix value
      await db.Product.create({
        id: uuidv4(),
        sku,
        name: `IronLite Core ${sku}`,
        brandCode: 'FW',
        productType: 'engineered_spc',
        categoryId: cat.id,
        factoryId: fac.id,
        originCountry: 'China',
        baseFobPrice: inflated,
        currency: 'USD',
        originVariants: [
          { origin: 'China',    factoryId: facHH.id }, // wrong key shape
          { origin: 'Malaysia', factoryId: fac.id },
        ],
      });
    }

    // Seed two PriceList rows matching the prod UUIDs the AI created.
    for (const id of BAD_PRICE_LIST_IDS) {
      await db.PriceList.create({
        id,
        name: id === BAD_PRICE_LIST_IDS[0]
          ? 'Engineered SPC - IronLite Core - Malaysia'
          : 'Engineered SPC - IronLite Core - China',
        currencyCode: 'USD',
        brandCode: id === BAD_PRICE_LIST_IDS[0] ? 'FW' : 'HH',
        isActive: true,
      });
    }
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('runs successfully on first call, idempotent on second', async () => {
    const r1 = await migrate428fIronlitePricesFix(db);
    expect(r1.productsFixed).toBe(9);
    expect(r1.listsArchived).toBe(2);

    const r2 = await migrate428fIronlitePricesFix(db);
    expect(r2.skipped).toBe(true);
  });

  test('every IL- Product has the canonical originVariants shape with buyer-ready prices', async () => {
    for (const [sku, prices] of Object.entries(IRONLITE_PRICES)) {
      const p = await db.Product.findOne({ where: { sku } });
      expect(p).toBeTruthy();
      const variants = p.originVariants;
      expect(Array.isArray(variants)).toBe(true);
      expect(variants.length).toBe(2);

      const cn = variants.find(v => v.originCountry === 'CN');
      const my = variants.find(v => v.originCountry === 'MY');

      expect(cn).toBeTruthy();
      expect(my).toBeTruthy();

      // Buyer-ready FOB from supplier sheet, NOT the +7% inflated value.
      expect(cn.fobPriceUsd).toBeCloseTo(prices.CN, 3);
      expect(my.fobPriceUsd).toBeCloseTo(prices.MY, 3);
      expect(cn.priceUnit).toBe('sqm');
      expect(my.priceUnit).toBe('sqm');

      // baseFobPrice (legacy scalar) is kept in sync with primary origin
      // and is the buyer-ready value, not the +7% inflated one.
      const base = Number(p.baseFobPrice);
      expect(base).toBeCloseTo(p.originCountry === 'MY' ? prices.MY : prices.CN, 3);

      // Sanity: every price must be strictly less than the inflated value
      // (== prices.CN * 1.07). If this fails, the markup is still applied.
      expect(base).toBeLessThan(prices.CN * 1.07);
    }
  });

  test('both bad PriceLists are archived (isActive=false)', async () => {
    for (const id of BAD_PRICE_LIST_IDS) {
      const pl = await db.PriceList.findByPk(id);
      expect(pl).toBeTruthy();
      expect(pl.isActive).toBe(false);
    }
  });

  test('no Product baseFobPrice still carries the +7%-inflated value', async () => {
    const products = await db.Product.findAll({ where: { productType: 'engineered_spc' } });
    for (const p of products) {
      const sku = p.sku;
      if (!IRONLITE_PRICES[sku]) continue;
      const inflatedCn = IRONLITE_PRICES[sku].CN * 1.07;
      const inflatedMy = IRONLITE_PRICES[sku].MY * 1.07;
      expect(Math.abs(Number(p.baseFobPrice) - inflatedCn)).toBeGreaterThan(0.01);
      expect(Math.abs(Number(p.baseFobPrice) - inflatedMy)).toBeGreaterThan(0.01);
    }
  });
});
