// Phase 4.15d-2a — Product Specifications service tests.
//
// Coverage:
//   - upsertProductSpec: happy path (create + update), product by SKU,
//     out-of-whitelist fields silently dropped, product not found.
//   - getProductSpec: by id and by SKU; not_found shapes.
//   - listProductSpecs: filters (flooringType, waterproof, hasValue).
//   - searchProductSpecs: LIKE-match across string fields, query <2 chars
//     rejected, matchedFields annotation.
//   - lookupSpecQa: alias normalization ("AC rating" → acRating);
//     not_yet_recorded shape when field is null; unknown_attribute shape;
//     found shape with value.
//   - archiveProductSpec: hard-delete, returns the deleted snapshot.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const svc = require('../../services/aiWriteServices/productSpecWriteService');

describe('Phase 4.15d-2a — productSpecWriteService', () => {
  let db, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();
  }, 30000);

  afterAll(async () => {
    await cleanup();
  });

  async function freshProduct(overrides = {}) {
    return db.Product.create({
      id: uuidv4(),
      name: overrides.name || `Test SPC ${uuidv4().slice(0, 6)}`,
      sku: overrides.sku || `TEST-SPC-${uuidv4().slice(0, 6)}`,
      unit: 'sqm',
      basePrice: 25,
      isActive: true,
      categoryId: testData.product.categoryId,
      factoryId: testData.factory.id,
    });
  }

  // ── upsertProductSpec ──────────────────────────────────────────────

  describe('upsertProductSpec', () => {
    it('creates a new spec row when none exists for the product', async () => {
      const product = await freshProduct();
      const result = await svc.upsertProductSpec({
        productId: product.id,
        flooringType: 'SPC',
        thickness: 4,
        waterproof: true,
        acRating: 'AC5',
      }, { userId: testData.admin.id });

      expect(result.ok).toBe(true);
      expect(result.created).toBe(true);
      expect(result.spec.flooringType).toBe('SPC');
      expect(Number(result.spec.thickness)).toBe(4);
      expect(result.spec.waterproof).toBe(true);
    });

    it('updates an existing spec row (one per product, unique index)', async () => {
      const product = await freshProduct();
      await svc.upsertProductSpec({
        productId: product.id, flooringType: 'SPC', thickness: 4,
      }, { userId: testData.admin.id });

      const result = await svc.upsertProductSpec({
        productId: product.id, thickness: 5, acRating: 'AC4',
      }, { userId: testData.admin.id });

      expect(result.ok).toBe(true);
      expect(result.created).toBe(false);
      expect(Number(result.spec.thickness)).toBe(5);
      expect(result.spec.flooringType).toBe('SPC');  // preserved from first upsert
      expect(result.spec.acRating).toBe('AC4');
    });

    it('resolves product by SKU when productSku passed instead of productId', async () => {
      const product = await freshProduct({ sku: `BY-SKU-${uuidv4().slice(0, 6)}` });
      const result = await svc.upsertProductSpec({
        productSku: product.sku,
        flooringType: 'WPC',
      }, { userId: testData.admin.id });

      expect(result.ok).toBe(true);
      expect(result.product.id).toBe(product.id);
      expect(result.spec.flooringType).toBe('WPC');
    });

    it('silently drops fields outside the writable whitelist', async () => {
      const product = await freshProduct();
      const result = await svc.upsertProductSpec({
        productId: product.id,
        flooringType: 'LVT',
        hackerField: 'should-not-persist',
        productId_again: 'no',  // sneaky
        id: uuidv4(),  // sneaky
      }, { userId: testData.admin.id });

      expect(result.ok).toBe(true);
      expect(result.spec.flooringType).toBe('LVT');
      expect(result.spec.hackerField).toBeUndefined();
    });

    it('returns not_found when the product does not exist', async () => {
      const result = await svc.upsertProductSpec({
        productId: uuidv4(),
        flooringType: 'SPC',
      }, { userId: testData.admin.id });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('not_found');
    });
  });

  // ── getProductSpec ─────────────────────────────────────────────────

  describe('getProductSpec', () => {
    it('returns the spec by product_id', async () => {
      const product = await freshProduct();
      await svc.upsertProductSpec({
        productId: product.id, flooringType: 'SPC', thickness: 5,
      }, { userId: testData.admin.id });

      const result = await svc.getProductSpec(product.id);
      expect(result.ok).toBe(true);
      expect(result.spec.flooringType).toBe('SPC');
      expect(result.product.sku).toBe(product.sku);
    });

    it('returns the spec by SKU', async () => {
      const product = await freshProduct();
      await svc.upsertProductSpec({
        productId: product.id, flooringType: 'WPC',
      }, { userId: testData.admin.id });

      const result = await svc.getProductSpec(product.sku);
      expect(result.ok).toBe(true);
      expect(result.spec.flooringType).toBe('WPC');
    });

    it('returns not_found when the product has no spec row', async () => {
      const product = await freshProduct();
      const result = await svc.getProductSpec(product.id);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('not_found');
      expect(result.message).toMatch(/erp_upsert_product_spec/);
    });
  });

  // ── listProductSpecs ───────────────────────────────────────────────

  describe('listProductSpecs', () => {
    it('filters by flooringType', async () => {
      const p1 = await freshProduct();
      const p2 = await freshProduct();
      await svc.upsertProductSpec({ productId: p1.id, flooringType: 'SPC' }, { userId: testData.admin.id });
      await svc.upsertProductSpec({ productId: p2.id, flooringType: 'LVT' }, { userId: testData.admin.id });

      const result = await svc.listProductSpecs({ flooringType: 'SPC' });
      expect(result.ok).toBe(true);
      const flooringTypes = result.specs.map(s => s.flooringType);
      expect(flooringTypes).toContain('SPC');
      expect(flooringTypes).not.toContain('LVT');
    });

    it('filters by waterproof boolean', async () => {
      const p = await freshProduct();
      await svc.upsertProductSpec({ productId: p.id, waterproof: true }, { userId: testData.admin.id });

      const wet = await svc.listProductSpecs({ waterproof: true });
      expect(wet.specs.length).toBeGreaterThan(0);
      expect(wet.specs.every(s => s.waterproof === true)).toBe(true);
    });

    it('hasValue narrows to rows where the named column is non-null', async () => {
      const p1 = await freshProduct();
      const p2 = await freshProduct();
      await svc.upsertProductSpec({ productId: p1.id, acRating: 'AC4' }, { userId: testData.admin.id });
      await svc.upsertProductSpec({ productId: p2.id, flooringType: 'SPC' }, { userId: testData.admin.id });

      const withAc = await svc.listProductSpecs({ hasValue: 'AC rating' });
      const acRatings = withAc.specs.map(s => s.acRating);
      expect(acRatings.every(r => r !== null && r !== undefined)).toBe(true);
    });
  });

  // ── searchProductSpecs ─────────────────────────────────────────────

  describe('searchProductSpecs', () => {
    it('LIKE-matches across string fields and annotates matchedFields', async () => {
      const p = await freshProduct();
      await svc.upsertProductSpec({
        productId: p.id,
        flooringType: 'SPC',
        woodSpecies: 'European Oak',
        surfaceFinish: 'Embossed in Register',
      }, { userId: testData.admin.id });

      const result = await svc.searchProductSpecs('European Oak');
      expect(result.ok).toBe(true);
      expect(result.resultCount).toBeGreaterThan(0);
      const ours = result.results.find(r => r.spec.productId === p.id);
      expect(ours).toBeTruthy();
      const fieldNames = ours.matchedFields.map(m => m.field);
      expect(fieldNames).toContain('woodSpecies');
    });

    it('refuses queries shorter than 2 chars', async () => {
      const result = await svc.searchProductSpecs('a');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('validation');
    });
  });

  // ── lookupSpecQa ───────────────────────────────────────────────────

  describe('lookupSpecQa', () => {
    it('aliases "AC rating" to acRating and returns the value', async () => {
      const p = await freshProduct();
      await svc.upsertProductSpec({
        productId: p.id, acRating: 'AC4',
      }, { userId: testData.admin.id });

      const result = await svc.lookupSpecQa({ product: p.sku, attribute: 'AC rating' });
      expect(result.ok).toBe(true);
      expect(result.answer).toBe('found');
      expect(result.normalised).toBe('acRating');
      expect(result.value).toBe('AC4');
    });

    it('aliases "wear layer" to wearLayerThickness', async () => {
      const p = await freshProduct();
      await svc.upsertProductSpec({
        productId: p.id, wearLayerThickness: 0.5,
      }, { userId: testData.admin.id });

      const result = await svc.lookupSpecQa({ product: p.id, attribute: 'wear layer' });
      expect(result.answer).toBe('found');
      expect(result.normalised).toBe('wearLayerThickness');
      expect(Number(result.value)).toBe(0.5);
    });

    it('returns not_yet_recorded when the field is null on the row', async () => {
      const p = await freshProduct();
      await svc.upsertProductSpec({
        productId: p.id, flooringType: 'SPC',
      }, { userId: testData.admin.id });

      const result = await svc.lookupSpecQa({ product: p.sku, attribute: 'AC rating' });
      expect(result.answer).toBe('not_yet_recorded');
      expect(result.value).toBe(null);
    });

    it('returns not_yet_recorded when no spec row exists at all', async () => {
      const p = await freshProduct();
      const result = await svc.lookupSpecQa({ product: p.id, attribute: 'thickness' });
      expect(result.answer).toBe('not_yet_recorded');
      expect(result.message).toMatch(/erp_upsert_product_spec/);
    });

    it('returns unknown_attribute when the attribute does not resolve', async () => {
      const p = await freshProduct();
      await svc.upsertProductSpec({
        productId: p.id, flooringType: 'SPC',
      }, { userId: testData.admin.id });

      const result = await svc.lookupSpecQa({ product: p.id, attribute: 'completely_made_up' });
      expect(result.answer).toBe('unknown_attribute');
      expect(result.normalised).toBe('completely_made_up');
    });

    it('rejects missing product or attribute', async () => {
      const a = await svc.lookupSpecQa({ attribute: 'AC rating' });
      expect(a.ok).toBe(false);
      const b = await svc.lookupSpecQa({ product: 'X' });
      expect(b.ok).toBe(false);
    });
  });

  // ── archiveProductSpec ─────────────────────────────────────────────

  describe('archiveProductSpec', () => {
    it('hard-deletes the spec row and returns the snapshot', async () => {
      const p = await freshProduct();
      await svc.upsertProductSpec({
        productId: p.id, flooringType: 'SPC', thickness: 5,
      }, { userId: testData.admin.id });

      const result = await svc.archiveProductSpec(p.id, { userId: testData.admin.id });
      expect(result.ok).toBe(true);
      expect(result.deleted.flooringType).toBe('SPC');
      expect(Number(result.deleted.thickness)).toBe(5);

      const followup = await svc.getProductSpec(p.id);
      expect(followup.ok).toBe(false);
      expect(followup.code).toBe('not_found');
    });

    it('returns not_found when there is no spec to archive', async () => {
      const p = await freshProduct();
      const result = await svc.archiveProductSpec(p.id, { userId: testData.admin.id });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('not_found');
    });
  });
});
