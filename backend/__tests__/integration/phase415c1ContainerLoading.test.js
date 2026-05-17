// Phase 4.15c-1 — Container loading service tests.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const svc = require('../../services/aiWriteServices/containerLoadingWriteService');

describe('Phase 4.15c-1 — containerLoadingWriteService', () => {
  let db, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  // ── createContainerLoad ─────────────────────────────────────────────

  describe('createContainerLoad', () => {
    it('happy path creates a planning-status container with auto-generated number', async () => {
      const r = await svc.createContainerLoad({
        containerType: '40ft_hc',
        destinationPort: 'Los Angeles',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.container.containerType).toBe('40ft_hc');
      expect(r.container.containerStatus).toBe('planning');
      expect(Number(r.container.maxWeight)).toBe(26500);
      expect(r.container.containerNumber).toMatch(/^PLAN-40FT_HC-\d+$/);
    });

    it('respects an explicit container_number', async () => {
      const cn = `EXPL-${uuidv4().slice(0, 6)}`;
      const r = await svc.createContainerLoad({
        containerType: '20ft', containerNumber: cn,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.container.containerNumber).toBe(cn);
    });

    it('refuses duplicate containerNumber with 409', async () => {
      const cn = `DUP-${uuidv4().slice(0, 6)}`;
      await svc.createContainerLoad({ containerType: '20ft', containerNumber: cn }, { userId: testData.admin.id });
      const second = await svc.createContainerLoad({
        containerType: '40ft', containerNumber: cn,
      }, { userId: testData.admin.id });
      expect(second.ok).toBe(false);
      expect(second.httpStatus).toBe(409);
    });

    it('rejects unknown containerType', async () => {
      const r = await svc.createContainerLoad({
        containerType: '53ft_super',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/Unknown containerType/);
    });

    it('rejects missing containerType', async () => {
      const r = await svc.createContainerLoad({}, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
    });
  });

  // ── optimizeContainerLoad ──────────────────────────────────────────

  describe('optimizeContainerLoad', () => {
    async function freshProduct(weight, cube) {
      return db.Product.create({
        id: uuidv4(),
        name: `Test ${uuidv4().slice(0, 4)}`,
        sku: `OPT-${uuidv4().slice(0, 6)}`,
        unit: 'sqm',
        basePrice: 25,
        weight: weight,
        cubicMeters: cube,
        categoryId: testData.product.categoryId,
        factoryId: testData.factory.id,
        isActive: true,
      });
    }

    it('returns fits=true when weight + cube are under limits', async () => {
      const p = await freshProduct(20, 0.05);  // 20 kg, 0.05 cbm each
      const r = await svc.optimizeContainerLoad({
        containerType: '20ft',
        items: [{ product_id: p.id, quantity: 100 }],
      });
      expect(r.ok).toBe(true);
      // 20 × 100 = 2000 kg < 21000 limit
      expect(r.plan.totalWeightKg).toBe(2000);
      // 0.05 × 100 = 5 cbm < 33 limit
      expect(r.plan.totalCubeCbm).toBe(5);
      expect(r.plan.fits).toBe(true);
      expect(r.plan.overweightBy).toBe(0);
    });

    it('returns fits=false when weight exceeds the container limit', async () => {
      const p = await freshProduct(100, 0.01);  // 100 kg each
      const r = await svc.optimizeContainerLoad({
        containerType: '20ft',
        items: [{ product_id: p.id, quantity: 500 }],  // 50,000 kg > 21,000
      });
      expect(r.ok).toBe(true);
      expect(r.plan.fits).toBe(false);
      expect(r.plan.overweightBy).toBeGreaterThan(0);
    });

    it('flags products with missing spec data (no weight, no cube)', async () => {
      const p = await freshProduct(null, null);
      const r = await svc.optimizeContainerLoad({
        containerType: '40ft',
        items: [{ product_id: p.id, quantity: 10 }],
      });
      expect(r.ok).toBe(true);
      expect(r.plan.items[0].hasSpecData).toBe(false);
    });

    it('marks product_not_found errors per line', async () => {
      const r = await svc.optimizeContainerLoad({
        containerType: '40ft',
        items: [
          { product_id: uuidv4(), quantity: 100 },  // doesn't exist
        ],
      });
      expect(r.ok).toBe(true);
      expect(r.plan.items[0].error).toBe('product_not_found');
    });

    it('rejects unknown containerType', async () => {
      const r = await svc.optimizeContainerLoad({
        containerType: 'box',
        items: [{ product_id: testData.product.id, quantity: 1 }],
      });
      expect(r.ok).toBe(false);
    });

    it('rejects empty items array', async () => {
      const r = await svc.optimizeContainerLoad({
        containerType: '20ft', items: [],
      });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/non-empty array/);
    });
  });

  // ── list / get / update ────────────────────────────────────────────

  describe('list + get + update', () => {
    let createdId;

    beforeAll(async () => {
      const r = await svc.createContainerLoad({
        containerType: '40ft', destinationPort: 'Long Beach',
      }, { userId: testData.admin.id });
      createdId = r.container.id;
    });

    it('listContainerLoads filters by containerStatus', async () => {
      const r = await svc.listContainerLoads({ containerStatus: 'planning' });
      expect(r.ok).toBe(true);
      expect(r.containers.some(c => c.id === createdId)).toBe(true);
    });

    it('getContainerLoad returns the row', async () => {
      const r = await svc.getContainerLoad(createdId);
      expect(r.ok).toBe(true);
      expect(r.container.id).toBe(createdId);
    });

    it('getContainerLoad 404s on unknown id', async () => {
      const r = await svc.getContainerLoad(uuidv4());
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });

    it('updateContainerLoad patches editable fields + returns before/after', async () => {
      const r = await svc.updateContainerLoad(createdId, {
        containerStatus: 'loading',
        cargoWeight: 12500,
        palletCount: 18,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.after.containerStatus).toBe('loading');
      expect(Number(r.after.cargoWeight)).toBe(12500);
      expect(r.after.palletCount).toBe(18);
      expect(r.before.containerStatus).toBe('planning');
    });
  });
});
