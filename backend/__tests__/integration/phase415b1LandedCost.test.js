// Phase 4.15b-1 — Landed Cost service tests.
//
// Coverage:
//   - createTemplate: happy path, missing name, duplicate name (409),
//     supplier-not-found 404, default components + percentages applied.
//   - listTemplates: name LIKE filter, supplier filter, active_only default.
//   - persistCalculation: happy path computes totals + creates row with
//     LCC-YYYYMMDD-NNN reference number; missing required fields
//     refused; product / supplier 404; ProductPrice.validTo expiration
//     check fires when origin supplied and price expired.
//   - listCalculations: filters compose correctly.
//   - getCalculation: happy path + not_found.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const svc = require('../../services/aiWriteServices/landedCostWriteService');

describe('Phase 4.15b-1 — landedCostWriteService', () => {
  let db, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  // ── createTemplate ──────────────────────────────────────────────────

  describe('createTemplate', () => {
    it('happy path creates a template with sensible defaults', async () => {
      const result = await svc.createTemplate({
        name: `Tpl China-US ${uuidv4().slice(0, 6)}`,
        countryOfOrigin: 'China',
        destinationCountry: 'USA',
      }, { userId: testData.admin.id });

      expect(result.ok).toBe(true);
      expect(result.template.countryOfOrigin).toBe('China');
      expect(result.template.destinationCountry).toBe('USA');
      expect(result.template.currency).toBe('USD');
      expect(result.template.isActive).toBe(true);
      expect(result.template.defaultPercentages).toEqual(expect.objectContaining({
        freightPercent: 5, insurancePercent: 1, customsDutyPercent: 10,
      }));
    });

    it('rejects missing name', async () => {
      const result = await svc.createTemplate({}, { userId: testData.admin.id });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('validation');
      expect(result.message).toMatch(/name is required/);
    });

    it('rejects duplicate name with 409', async () => {
      const name = `Dup Template ${uuidv4().slice(0, 6)}`;
      await svc.createTemplate({ name }, { userId: testData.admin.id });
      const second = await svc.createTemplate({ name }, { userId: testData.admin.id });
      expect(second.ok).toBe(false);
      expect(second.httpStatus).toBe(409);
      expect(second.message).toMatch(/already exists/);
    });

    it('rejects unknown supplier_id with 404', async () => {
      const result = await svc.createTemplate({
        name: `Bad Supplier ${uuidv4().slice(0, 6)}`,
        supplierId: uuidv4(),  // does not exist
      }, { userId: testData.admin.id });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('not_found');
    });
  });

  // ── listTemplates ──────────────────────────────────────────────────

  describe('listTemplates', () => {
    it('LIKE-matches name and respects active_only default', async () => {
      const tag = uuidv4().slice(0, 6);
      await svc.createTemplate({ name: `Active ${tag}` }, { userId: testData.admin.id });
      await svc.createTemplate({ name: `Inactive ${tag}`, isActive: false }, { userId: testData.admin.id });

      const onlyActive = await svc.listTemplates({ name: tag });
      const names = onlyActive.templates.map(t => t.name);
      expect(names.some(n => n.startsWith('Active'))).toBe(true);
      expect(names.some(n => n.startsWith('Inactive'))).toBe(false);

      const both = await svc.listTemplates({ name: tag, activeOnly: false });
      expect(both.templates.length).toBe(2);
    });

    it('filters by supplier_id', async () => {
      const tag = uuidv4().slice(0, 6);
      await svc.createTemplate({
        name: `WithFactory ${tag}`, supplierId: testData.factory.id,
      }, { userId: testData.admin.id });
      await svc.createTemplate({
        name: `NoFactory ${tag}`,
      }, { userId: testData.admin.id });

      const filtered = await svc.listTemplates({ supplierId: testData.factory.id });
      const hasOurs = filtered.templates.some(t => t.name === `WithFactory ${tag}`);
      const hasOther = filtered.templates.some(t => t.name === `NoFactory ${tag}`);
      expect(hasOurs).toBe(true);
      expect(hasOther).toBe(false);
    });
  });

  // ── persistCalculation ─────────────────────────────────────────────

  describe('persistCalculation', () => {
    it('happy path computes totals + creates a row with LCC-YYYYMMDD-NNN ref', async () => {
      const result = await svc.persistCalculation({
        productId: testData.product.id,
        supplierId: testData.factory.id,
        quantity: 100,
        productCost: 12.50,
        freight: 200,
        insurance: 50,
        customsDuty: 100,
        handlingCharges: 75,
        localDelivery: 25,
      }, { userId: testData.admin.id });

      expect(result.ok).toBe(true);
      const c = result.calculation;
      expect(c.referenceNumber).toMatch(/^LCC-\d{8}-\d{3,4}$/);
      // 12.50 × 100 = 1250 + 200 + 50 + 100 + 75 + 25 = 1700
      expect(Number(c.totalLandedCost)).toBeCloseTo(1700, 2);
      expect(Number(c.costPerUnit)).toBeCloseTo(17, 2);
      expect(c.productId).toBe(testData.product.id);
      expect(c.supplierId).toBe(testData.factory.id);
      expect(c.unit).toBe(testData.product.unit);
    });

    it('rejects missing required fields', async () => {
      const a = await svc.persistCalculation({}, { userId: testData.admin.id });
      expect(a.ok).toBe(false);
      const b = await svc.persistCalculation({
        productId: testData.product.id,
      }, { userId: testData.admin.id });
      expect(b.ok).toBe(false);
      expect(b.message).toMatch(/supplierId/);
    });

    it('rejects quantity <= 0', async () => {
      const result = await svc.persistCalculation({
        productId: testData.product.id,
        supplierId: testData.factory.id,
        quantity: 0,
        productCost: 10,
      }, { userId: testData.admin.id });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/quantity must be > 0/);
    });

    it('returns 404 when product does not exist', async () => {
      const result = await svc.persistCalculation({
        productId: uuidv4(),
        supplierId: testData.factory.id,
        quantity: 1,
        productCost: 10,
      }, { userId: testData.admin.id });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('not_found');
    });

    it('returns 404 when supplier does not exist', async () => {
      const result = await svc.persistCalculation({
        productId: testData.product.id,
        supplierId: uuidv4(),
        quantity: 1,
        productCost: 10,
      }, { userId: testData.admin.id });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('not_found');
    });

    it('fails with price_expired when ProductPrice.validTo is in the past for the origin', async () => {
      // Seed an expired ProductPrice for this product+origin. The model
      // has no isActive flag — "active" is governed by validFrom/validTo
      // window. Expiry triggers when validTo < now.
      await db.ProductPrice.create({
        id: uuidv4(),
        productId: testData.product.id,
        origin: 'CN',
        costPriceUsdPerM2: 10,
        sellingPriceUsdPerM2: 25,
        currency: 'USD',
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2026-03-01'),  // expired
      });

      const result = await svc.persistCalculation({
        productId: testData.product.id,
        supplierId: testData.factory.id,
        quantity: 100,
        productCost: 10,
        origin: 'CN',
      }, { userId: testData.admin.id });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('price_expired');
      expect(result.message).toMatch(/expired/);
      expect(result.message).toMatch(/erp_create_product_price/);
    });

    it('skips the price check when no origin is supplied', async () => {
      // Even with an expired price in the DB (seeded above), no origin
      // arg means we don't know which row would govern → fall through.
      const result = await svc.persistCalculation({
        productId: testData.product.id,
        supplierId: testData.factory.id,
        quantity: 50,
        productCost: 10,
      }, { userId: testData.admin.id });
      expect(result.ok).toBe(true);
    });
  });

  // ── listCalculations + getCalculation ──────────────────────────────

  describe('listCalculations + getCalculation', () => {
    let createdId;

    beforeAll(async () => {
      const r = await svc.persistCalculation({
        productId: testData.product.id,
        supplierId: testData.factory.id,
        quantity: 250,
        productCost: 8,
        freight: 100,
      }, { userId: testData.admin.id });
      createdId = r.calculation.id;
    });

    it('filters by productId', async () => {
      const result = await svc.listCalculations({ productId: testData.product.id });
      expect(result.ok).toBe(true);
      const ours = result.calculations.find(c => c.id === createdId);
      expect(ours).toBeTruthy();
    });

    it('filters by supplierId', async () => {
      const result = await svc.listCalculations({ supplierId: testData.factory.id });
      expect(result.ok).toBe(true);
      expect(result.calculations.length).toBeGreaterThan(0);
    });

    it('search by reference number LIKE', async () => {
      const orig = await svc.getCalculation(createdId);
      const tail = orig.calculation.referenceNumber.slice(-5);
      const result = await svc.listCalculations({ search: tail });
      expect(result.calculations.some(c => c.id === createdId)).toBe(true);
    });

    it('getCalculation returns the full row', async () => {
      const result = await svc.getCalculation(createdId);
      expect(result.ok).toBe(true);
      expect(result.calculation.id).toBe(createdId);
      expect(Number(result.calculation.totalLandedCost)).toBeGreaterThan(0);
    });

    it('getCalculation returns not_found for unknown id', async () => {
      const result = await svc.getCalculation(uuidv4());
      expect(result.ok).toBe(false);
      expect(result.code).toBe('not_found');
    });
  });
});
