// Phase 4.9.5 — GET /api/products/:id/current-price.
//
// Wraps services/productPriceService.getCurrentPrice as a REST
// endpoint so external callers (mobile, integrations) can read the
// canonical current price without going through the
// Product.baseFobPrice cache column directly.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('GET /api/products/:id/current-price (Phase 4.9.5)', () => {
  let db, request, testData, productWithPrice, productWithoutPrice;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();

    // Two test products: one with an active ProductPrice, one without.
    // testData.factory is the seeded Factory (required FK).
    const cat = await db.ProductCategory.create({ id: uuidv4(), name: `T495 cat ${Date.now()}` });
    productWithPrice = await db.Product.create({
      id: uuidv4(),
      brandCode: 'SH',
      name: 'Phase 4.9.5 priced product',
      sku: `T495-PRICED-${Date.now()}`,
      categoryId: cat.id,
      factoryId: testData.factory.id,
      isActive: true,
      originCountry: 'CN',
    });
    productWithoutPrice = await db.Product.create({
      id: uuidv4(),
      brandCode: 'SH',
      name: 'Phase 4.9.5 unpriced product',
      sku: `T495-UNPRICED-${Date.now()}`,
      categoryId: cat.id,
      factoryId: testData.factory.id,
      isActive: true,
      originCountry: 'CN',
    });

    await db.ProductPrice.create({
      id: uuidv4(),
      productId: productWithPrice.id,
      origin: 'CN',
      costPriceUsdPerM2: 5.80,
      sellingPriceUsdPerM2: 6.20,
      currency: 'USD',
      validFrom: new Date().toISOString().slice(0, 10),
      sourceNote: 'integration test seed',
    });
  }, 30000);

  afterAll(async () => {
    await cleanup();
  });

  test('returns the current price for a product with an active ProductPrice row', async () => {
    const r = await request
      .get(`/api/products/${productWithPrice.id}/current-price`)
      .set('Authorization', `Bearer ${testData.authToken}`);
    expect(r.status).toBe(200);
    const body = r.body?.data ?? r.body;
    expect(body).toBeTruthy();
    expect(body.productId).toBe(productWithPrice.id);
    expect(Number(body.costPriceUsdPerM2)).toBeCloseTo(5.80, 2);
    expect(Number(body.sellingPriceUsdPerM2)).toBeCloseTo(6.20, 2);
    // Decorated derived fields
    expect(body.sellingPriceUsdPerSqft).toBeGreaterThan(0);
    expect(body.sellingPriceUsdPerSqft).toBeLessThan(Number(body.sellingPriceUsdPerM2));
  });

  test('returns null payload when product has no active ProductPrice', async () => {
    const r = await request
      .get(`/api/products/${productWithoutPrice.id}/current-price`)
      .set('Authorization', `Bearer ${testData.authToken}`);
    expect(r.status).toBe(200);
    // Supertest doesn't run the axios envelope-unwrap interceptor, so
    // r.body is the raw { success, data, message } envelope. data
    // is null when no active row exists.
    expect(r.body.data).toBeNull();
    expect(typeof r.body.message).toBe('string');
  });

  test('404 when product does not exist', async () => {
    const r = await request
      .get(`/api/products/${uuidv4()}/current-price`)
      .set('Authorization', `Bearer ${testData.authToken}`);
    expect(r.status).toBe(404);
  });

  test('requires auth', async () => {
    const r = await request.get(`/api/products/${productWithPrice.id}/current-price`);
    expect(r.status).toBe(401);
  });

  test('respects an explicit origin query param', async () => {
    // Add a second price row at a different origin
    await db.ProductPrice.create({
      id: uuidv4(),
      productId: productWithPrice.id,
      origin: 'MY',
      costPriceUsdPerM2: 4.50,
      sellingPriceUsdPerM2: 5.00,
      currency: 'USD',
      validFrom: new Date().toISOString().slice(0, 10),
    });

    const r = await request
      .get(`/api/products/${productWithPrice.id}/current-price?origin=MY`)
      .set('Authorization', `Bearer ${testData.authToken}`);
    expect(r.status).toBe(200);
    const body = r.body?.data ?? r.body;
    expect(body.origin).toBe('MY');
    expect(Number(body.sellingPriceUsdPerM2)).toBeCloseTo(5.00, 2);
  });
});
