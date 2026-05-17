// Phase 4.17 — Product approval workflow endpoints.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Phase 4.17 — product approval endpoints', () => {
  let request, db, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  async function makePending(overrides = {}) {
    const { v4 } = require('uuid');
    const p = await db.Product.create({
      id: v4(),
      brandCode: 'SH',
      name: 'Pending Product',
      sku: `PND-${v4().slice(0, 6)}`,
      categoryId: testData.product.categoryId,
      factoryId: testData.factory.id,
      unit: 'sqm',
      isActive: false,
      ...overrides,
    });
    const activity = await db.ScheduledActivity.create({
      type: 'approve',
      entityType: 'Product',
      entityId: p.id,
      entityLabel: `${p.name} (${p.sku})`,
      assignedToId: testData.admin.id,
      assignedById: testData.admin.id,
      dueDate: new Date().toISOString().slice(0, 10),
      priority: 'normal',
      note: 'New product pending review',
      status: 'pending',
    });
    return { product: p, activity };
  }

  // ── approve ────────────────────────────────────────────────────────

  describe('POST /api/products/:id/approve', () => {
    it('flips isActive, reports price count, closes activity', async () => {
      const { product, activity } = await makePending();
      await db.ProductPrice.create({
        productId: product.id,
        factoryId: testData.factory.id,
        costPriceUsdPerM2: 8.5,
        sellingPriceUsdPerM2: 9.0,
        currency: 'USD',
        validFrom: '2026-01-01',
      });

      const r = await request
        .post(`/api/products/${product.id}/approve`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({ note: 'Looks good, approved.' });

      expect(r.status).toBe(200);
      expect(r.body.data.pricesAffected).toBe(1);
      expect(r.body.data.activitiesClosed).toBe(1);

      const after = await db.Product.findByPk(product.id);
      expect(after.isActive).toBe(true);

      const sa = await db.ScheduledActivity.findByPk(activity.id);
      expect(sa.status).toBe('done');
      expect(sa.completedNote).toContain('Looks good');
      expect(sa.completedAt).toBeTruthy();
    });

    it('approves an already-active product idempotently', async () => {
      const { product } = await makePending({ isActive: true });
      const r = await request
        .post(`/api/products/${product.id}/approve`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({});
      expect(r.status).toBe(200);
      expect(r.body.data.wasActive).toBe(true);
    });

    it('404s on unknown product', async () => {
      const r = await request
        .post(`/api/products/${uuidv4()}/approve`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({});
      expect(r.status).toBe(404);
    });

    it('rejects unauthenticated requests', async () => {
      const r = await request.post(`/api/products/${uuidv4()}/approve`).send({});
      expect(r.status).toBe(401);
    });
  });

  // ── reject ─────────────────────────────────────────────────────────

  describe('POST /api/products/:id/reject', () => {
    it('soft-deletes product + closes price windows + cancels activity', async () => {
      const { product, activity } = await makePending();
      await db.ProductPrice.create({
        productId: product.id,
        factoryId: testData.factory.id,
        costPriceUsdPerM2: 8.5,
        currency: 'USD',
        validFrom: '2026-01-01',
        validTo: null,  // open window
      });

      const r = await request
        .post(`/api/products/${product.id}/reject`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({ reason: 'Wrong factory mapping. Reassign to FlorWay.' });

      expect(r.status).toBe(200);
      expect(r.body.data.activitiesCancelled).toBe(1);

      const after = await db.Product.findByPk(product.id);
      expect(after.deletedAt).toBeTruthy();
      expect(after.isActive).toBe(false);

      // Price window closed: validTo set to today.
      const price = await db.ProductPrice.findOne({ where: { productId: product.id } });
      expect(price.validTo).toBeTruthy();
      const todayStr = new Date().toISOString().slice(0, 10);
      expect(String(price.validTo).slice(0, 10)).toBe(todayStr);

      const sa = await db.ScheduledActivity.findByPk(activity.id);
      expect(sa.status).toBe('cancelled');
      expect(sa.completedNote).toContain('Wrong factory mapping');
    });

    it('400s without a reason', async () => {
      const { product } = await makePending();
      const r = await request
        .post(`/api/products/${product.id}/reject`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({});
      expect(r.status).toBe(400);
    });

    it('400s with empty whitespace reason', async () => {
      const { product } = await makePending();
      const r = await request
        .post(`/api/products/${product.id}/reject`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({ reason: '   ' });
      expect(r.status).toBe(400);
    });

    it('404s on unknown product', async () => {
      const r = await request
        .post(`/api/products/${uuidv4()}/reject`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({ reason: 'bad' });
      expect(r.status).toBe(404);
    });
  });

  // ── request-revision ───────────────────────────────────────────────

  describe('POST /api/products/:id/request-revision', () => {
    it('closes current activity + spawns follow_up to the original requester', async () => {
      const { product, activity } = await makePending();

      const r = await request
        .post(`/api/products/${product.id}/request-revision`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({ comment: 'Spec sheet missing — please re-attach.' });

      expect(r.status).toBe(200);
      expect(r.body.data.closedActivities).toBe(1);
      expect(r.body.data.followUpActivityId).toBeTruthy();

      const original = await db.ScheduledActivity.findByPk(activity.id);
      expect(original.status).toBe('done');
      expect(original.completedNote).toContain('Revision requested');
      expect(original.completedNote).toContain('Spec sheet missing');

      const followUp = await db.ScheduledActivity.findByPk(r.body.data.followUpActivityId);
      expect(followUp.type).toBe('follow_up');
      expect(followUp.entityType).toBe('Product');
      expect(followUp.entityId).toBe(product.id);
      expect(followUp.priority).toBe('high');
      expect(followUp.status).toBe('pending');
      expect(followUp.note).toContain('Spec sheet missing');
      // Routes back to the original requester (assignedById of the closed activity).
      expect(followUp.assignedToId).toBe(activity.assignedById);

      const after = await db.Product.findByPk(product.id);
      // Revision keeps the product inactive (does NOT soft-delete).
      expect(after.isActive).toBe(false);
      expect(after.deletedAt).toBeFalsy();
    });

    it('400s without a comment', async () => {
      const { product } = await makePending();
      const r = await request
        .post(`/api/products/${product.id}/request-revision`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({});
      expect(r.status).toBe(400);
    });

    it('404s on unknown product', async () => {
      const r = await request
        .post(`/api/products/${uuidv4()}/request-revision`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({ comment: 'x' });
      expect(r.status).toBe(404);
    });
  });

  // ── activity is correctly closed across all 3 paths ────────────────

  describe('activity state machine', () => {
    it('approve only closes the matching Product+pending activity, not others', async () => {
      const { product, activity: targetActivity } = await makePending();
      // Add an unrelated activity on a different product.
      const otherActivity = await db.ScheduledActivity.create({
        type: 'approve',
        entityType: 'Product',
        entityId: uuidv4(),  // different productId
        entityLabel: 'Other product',
        assignedToId: testData.admin.id,
        assignedById: testData.admin.id,
        dueDate: new Date().toISOString().slice(0, 10),
        priority: 'normal',
        status: 'pending',
      });

      await request
        .post(`/api/products/${product.id}/approve`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({});

      const reloadTarget = await db.ScheduledActivity.findByPk(targetActivity.id);
      expect(reloadTarget.status).toBe('done');

      const reloadOther = await db.ScheduledActivity.findByPk(otherActivity.id);
      expect(reloadOther.status).toBe('pending');  // unaffected
    });
  });
});
