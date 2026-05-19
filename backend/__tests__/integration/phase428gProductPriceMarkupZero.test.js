// Phase 4.28g — FW/HH ProductPrice markup_percent must be zero.
//
// The 2026-05-19 IronLite incident had two layers. Phase 4.28f fixed
// Product.originVariants. This file locks the second layer: the
// parallel ProductPrice table where every IL- row had markup_percent =
// 0.07 on top of a cost_price that was ALREADY the supplier's buyer-
// ready FOB. The reconcile job then resolved selling = cost * 1.07 and
// overwrote Product.baseFobPrice on every boot, defeating 4.28f.
//
// Locks:
//   1. Migration is idempotent.
//   2. After migration, every FW/HH ProductPrice row has
//      markup_percent = 0 and sellingPriceUsdPerM2 == costPriceUsdPerM2.
//   3. Non-FW/HH (e.g. SH) ProductPrice rows are untouched.

const { v4: uuidv4 } = require('uuid');
const { migrate428gProductPriceMarkupZero } = require('../../services/migrate428gProductPriceMarkupZero');

describe('Phase 4.28g — FW/HH ProductPrice markup zero', () => {
  let db;
  let fwProductId;
  let hhProductId;
  let shProductId;

  beforeAll(async () => {
    db = require('../../models');
    await db.sequelize.sync({ force: true });

    const cat = await db.ProductCategory.create({
      id: uuidv4(),
      name: 'Engineered SPC',
      slug: 'engineered-spc',
      defaultBrand: 'FW',
    });
    const fac = await db.Factory.create({
      id: uuidv4(),
      companyName: 'FlorWay (test)',
      email: 'fw@test.example',
      phone: '+60-test',
      brandCode: 'FW',
    });

    // FW product + ProductPrice row with markup_percent = 0.07
    fwProductId = uuidv4();
    await db.Product.create({
      id: fwProductId,
      sku: 'IL-180x1220-6.5mm',
      name: 'IronLite Core 6.5mm',
      brandCode: 'FW',
      productType: 'engineered_spc',
      categoryId: cat.id,
      factoryId: fac.id,
      originCountry: 'China',
      baseFobPrice: 9.732,
      currency: 'USD',
      originVariants: [],
    });
    await db.ProductPrice.create({
      id: uuidv4(),
      productId: fwProductId,
      factoryId: fac.id,
      origin: 'China',
      costPriceUsdPerM2: 9.095,
      markupPercent: 0.07,
      sellingPriceUsdPerM2: null,
      currency: 'USD',
      validFrom: '2026-05-14',
    });

    // HH product + ProductPrice row with markup_percent = 0.07
    hhProductId = uuidv4();
    await db.Product.create({
      id: hhProductId,
      sku: 'IL-180x1220-7.0mm',
      name: 'IronLite Core 7.0mm',
      brandCode: 'HH',
      productType: 'engineered_spc',
      categoryId: cat.id,
      factoryId: fac.id,
      originCountry: 'China',
      baseFobPrice: 10.308,
      currency: 'USD',
      originVariants: [],
    });
    await db.ProductPrice.create({
      id: uuidv4(),
      productId: hhProductId,
      factoryId: fac.id,
      origin: 'China',
      costPriceUsdPerM2: 9.634,
      markupPercent: 0.07,
      sellingPriceUsdPerM2: null,
      currency: 'USD',
      validFrom: '2026-05-14',
    });

    // SH product with a markup of 0.05 — must stay untouched. Sovern is
    // a buying house for SH; markup is the right interpretation here.
    shProductId = uuidv4();
    await db.Product.create({
      id: shProductId,
      sku: 'SH-OAK-14',
      name: 'SH Oak Engineered 14mm',
      brandCode: 'SH',
      productType: 'hardwood',
      categoryId: cat.id,
      factoryId: fac.id,
      originCountry: 'China',
      baseFobPrice: 21.0,
      currency: 'USD',
      originVariants: [],
    });
    await db.ProductPrice.create({
      id: uuidv4(),
      productId: shProductId,
      factoryId: fac.id,
      origin: 'China',
      costPriceUsdPerM2: 20.0,
      markupPercent: 0.05,
      sellingPriceUsdPerM2: null,
      currency: 'USD',
      validFrom: '2026-05-14',
    });
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('first run fixes FW + HH rows, leaves SH alone', async () => {
    const r = await migrate428gProductPriceMarkupZero(db);
    expect(r.fixed).toBe(2);
    expect(r.scanned).toBe(2); // only FW + HH rows scanned
  });

  test('second run is a no-op (sentinel-guarded)', async () => {
    const r = await migrate428gProductPriceMarkupZero(db);
    expect(r.skipped).toBe(true);
  });

  test('FW row: markupPercent=0, sellingPriceUsdPerM2==costPriceUsdPerM2', async () => {
    const row = await db.ProductPrice.findOne({ where: { productId: fwProductId } });
    expect(Number(row.markupPercent)).toBe(0);
    expect(Number(row.sellingPriceUsdPerM2)).toBeCloseTo(9.095, 3);
    expect(Number(row.costPriceUsdPerM2)).toBeCloseTo(9.095, 3);
  });

  test('HH row: markupPercent=0, sellingPriceUsdPerM2==costPriceUsdPerM2', async () => {
    const row = await db.ProductPrice.findOne({ where: { productId: hhProductId } });
    expect(Number(row.markupPercent)).toBe(0);
    expect(Number(row.sellingPriceUsdPerM2)).toBeCloseTo(9.634, 3);
    expect(Number(row.costPriceUsdPerM2)).toBeCloseTo(9.634, 3);
  });

  test('SH row is untouched (still markupPercent=0.05, selling null)', async () => {
    const row = await db.ProductPrice.findOne({ where: { productId: shProductId } });
    expect(Number(row.markupPercent)).toBeCloseTo(0.05, 4);
    expect(row.sellingPriceUsdPerM2).toBeNull();
  });
});
