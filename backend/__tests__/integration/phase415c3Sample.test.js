// Phase 4.15c-3 — Sample management service tests.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const svc = require('../../services/aiWriteServices/sampleWriteService');

describe('Phase 4.15c-3 — sampleWriteService', () => {
  let db, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  // ── createSampleRequest ────────────────────────────────────────────

  describe('createSampleRequest', () => {
    it('happy path creates a pending request with summed totalQuantity', async () => {
      const r = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [
          { productId: testData.product.id, quantity: 5 },
          { productId: testData.product.id, quantity: 3, notes: 'finish B' },
        ],
        priority: 'high',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.request.status).toBe('pending');
      expect(r.request.priority).toBe('high');
      expect(Number(r.request.totalQuantity)).toBe(8);
      expect(r.request.requestNumber).toMatch(/^SR-\d+-[A-Z0-9]+$/);
    });

    it('rejects empty products array', async () => {
      const r = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [],
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/products/);
    });

    it('rejects unknown priority', async () => {
      const r = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [{ productId: testData.product.id, quantity: 1 }],
        priority: 'eventually',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/priority/);
    });

    it('404s on unknown customerId', async () => {
      const r = await svc.createSampleRequest({
        customerId: uuidv4(),
        products: [{ productId: testData.product.id, quantity: 1 }],
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });

    it('404s on unknown productId in products', async () => {
      const r = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [{ productId: uuidv4(), quantity: 2 }],
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
      expect(r.message).toMatch(/Product/);
    });

    it('rejects non-positive quantity', async () => {
      const r = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [{ productId: testData.product.id, quantity: 0 }],
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/quantity/);
    });
  });

  // ── approve + state machine ────────────────────────────────────────

  describe('approveSampleRequest + state machine', () => {
    let requestId;

    beforeAll(async () => {
      const r = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [{ productId: testData.product.id, quantity: 4 }],
      }, { userId: testData.admin.id });
      requestId = r.request.id;
    });

    it('approves a pending request', async () => {
      const r = await svc.approveSampleRequest(requestId, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.after.status).toBe('approved');
      expect(r.after.approvedBy).toBe(testData.admin.id);
      expect(r.after.approvalDate).toBeTruthy();
      expect(r.before.status).toBe('pending');
    });

    it('refuses to re-approve an already-approved request', async () => {
      const r = await svc.approveSampleRequest(requestId, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/pending/);
    });

    it('approve 404s on unknown id', async () => {
      const r = await svc.approveSampleRequest(uuidv4(), { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });

    it('approve rejects without ctx.userId', async () => {
      const fresh = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [{ productId: testData.product.id, quantity: 1 }],
      }, { userId: testData.admin.id });
      const r = await svc.approveSampleRequest(fresh.request.id, {});
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/userId/);
    });
  });

  // ── shipments ──────────────────────────────────────────────────────

  describe('createSampleShipment', () => {
    let requestId;

    beforeAll(async () => {
      const r = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [{ productId: testData.product.id, quantity: 10 }],
      }, { userId: testData.admin.id });
      requestId = r.request.id;
      await svc.approveSampleRequest(requestId, { userId: testData.admin.id });
    });

    it('happy path creates a shipment and promotes the parent to shipped', async () => {
      const r = await svc.createSampleShipment({
        sampleRequestId: requestId,
        quantity: 10,
        shippingMethod: 'courier',
        carrier: 'DHL',
        trackingNumber: 'DHL-12345',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.shipment.shipmentNumber).toMatch(/^SS-\d+-[A-Z0-9]+$/);
      expect(r.shipment.status).toBe('shipped');
      expect(r.requestBefore.status).toBe('approved');
      expect(r.requestAfter.status).toBe('shipped');
    });

    it('does not re-promote when the request is already shipped (subsequent shipments preserve status)', async () => {
      const r = await svc.createSampleShipment({
        sampleRequestId: requestId,
        quantity: 2,
        carrier: 'FedEx',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      // request was already shipped, so no requestBefore/After change
      expect(r.requestBefore).toBeNull();
      expect(r.requestAfter).toBeNull();
    });

    it('rejects shipment for a pending (unapproved) request', async () => {
      const pending = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [{ productId: testData.product.id, quantity: 1 }],
      }, { userId: testData.admin.id });
      const r = await svc.createSampleShipment({
        sampleRequestId: pending.request.id,
        quantity: 1,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/pending/);
    });

    it('rejects unknown shippingMethod', async () => {
      const r = await svc.createSampleShipment({
        sampleRequestId: requestId,
        quantity: 1,
        shippingMethod: 'teleport',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/shippingMethod/);
    });

    it('rejects non-positive quantity', async () => {
      const r = await svc.createSampleShipment({
        sampleRequestId: requestId,
        quantity: 0,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/quantity/);
    });
  });

  // ── feedback ───────────────────────────────────────────────────────

  describe('recordSampleFeedback', () => {
    let requestId;

    beforeAll(async () => {
      const r = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [{ productId: testData.product.id, quantity: 1 }],
      }, { userId: testData.admin.id });
      requestId = r.request.id;
    });

    it('happy path records feedback with default status by rating', async () => {
      const r = await svc.recordSampleFeedback({
        sampleRequestId: requestId,
        rating: 5,
        quality: 5,
        packaging: 4,
        comments: 'Great match.',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.feedback.rating).toBe(5);
      expect(r.feedback.status).toBe('pending_action');
    });

    it('low rating defaults status to escalated', async () => {
      const r = await svc.recordSampleFeedback({
        sampleRequestId: requestId,
        rating: 2,
        comments: 'Color was wrong.',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.feedback.status).toBe('escalated');
    });

    it('rejects rating outside 1–5', async () => {
      const r = await svc.recordSampleFeedback({
        sampleRequestId: requestId,
        rating: 7,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/rating/);
    });

    it('rejects sub-axis score outside 1–5', async () => {
      const r = await svc.recordSampleFeedback({
        sampleRequestId: requestId,
        rating: 4,
        quality: 9,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/quality/);
    });

    it('404s on unknown sampleRequestId', async () => {
      const r = await svc.recordSampleFeedback({
        sampleRequestId: uuidv4(),
        rating: 4,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });
  });

  // ── list + get ─────────────────────────────────────────────────────

  describe('list + get', () => {
    it('listSampleRequests filters by status', async () => {
      const r = await svc.listSampleRequests({ status: 'pending' });
      expect(r.ok).toBe(true);
      expect(r.requests.every(req => req.status === 'pending')).toBe(true);
    });

    it('listSampleRequests rejects unknown status', async () => {
      const r = await svc.listSampleRequests({ status: 'whoknows' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/status/);
    });

    it('getSampleRequest returns shipments + feedback eager-loaded', async () => {
      const seed = await svc.createSampleRequest({
        customerId: testData.customer.id,
        products: [{ productId: testData.product.id, quantity: 2 }],
      }, { userId: testData.admin.id });
      await svc.approveSampleRequest(seed.request.id, { userId: testData.admin.id });
      await svc.createSampleShipment({
        sampleRequestId: seed.request.id, quantity: 2, carrier: 'UPS',
      }, { userId: testData.admin.id });
      await svc.recordSampleFeedback({
        sampleRequestId: seed.request.id, rating: 4,
      }, { userId: testData.admin.id });

      const r = await svc.getSampleRequest(seed.request.id);
      expect(r.ok).toBe(true);
      expect(r.request.shipments.length).toBe(1);
      expect(r.request.feedback.length).toBe(1);
      expect(r.request.customer).toBeDefined();
    });

    it('getSampleRequest 404s on unknown id', async () => {
      const r = await svc.getSampleRequest(uuidv4());
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });
  });
});
