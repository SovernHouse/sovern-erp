const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Purchase Orders Integration Tests', () => {
  let db, request, testData;
  let factory, product, category;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();

    factory = await db.Factory.create({
      id: uuidv4(),
      companyName: 'PO Test Factory',
      email: `po-factory-${uuidv4()}@example.com`,
      phone: '+1234567890'
    });

    category = await db.ProductCategory.create({
      id: uuidv4(),
      name: 'Flooring'
    });

    product = await db.Product.create({
      id: uuidv4(),
      name: 'Laminate Flooring',
      sku: `SKU-${uuidv4()}`,
      categoryId: category.id,
      factoryId: factory.id
    });
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  describe('POST /api/purchase-orders', () => {
    it('should create a purchase order', async () => {
      const response = await request
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 200,
              unitPrice: 30
            }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(['draft', 'confirmed']).toContain(response.body.data.status);
    });

    it('should require factory ID', async () => {
      const response = await request
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          items: [
            {
              productId: product.id,
              quantity: 200,
              unitPrice: 30
            }
          ]
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request
        .post('/api/purchase-orders')
        .send({
          factoryId: factory.id,
          items: []
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/purchase-orders', () => {
    it('should list purchase orders', async () => {
      const response = await request
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request
        .get('/api/purchase-orders?page=1&limit=10')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/purchase-orders/:id', () => {
    let poId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 200,
              unitPrice: 30
            }
          ]
        }, 180000);

      poId = response.body.data.id;
    }, 180000);

    it('should get purchase order by ID', async () => {
      const response = await request
        .get(`/api/purchase-orders/${poId}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(poId);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request
        .get(`/api/purchase-orders/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/purchase-orders/:id', () => {
    let poId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 200,
              unitPrice: 30
            }
          ]
        }, 180000);

      poId = response.body.data.id;
    }, 180000);

    it('should update purchase order', async () => {
      const response = await request
        .put(`/api/purchase-orders/${poId}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          discount: 100,
          tax: 200
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('DELETE /api/purchase-orders/:id', () => {
    let poId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 200,
              unitPrice: 30
            }
          ]
        }, 180000);

      poId = response.body.data.id;
    }, 180000);

    it('should delete purchase order', async () => {
      const response = await request
        .delete(`/api/purchase-orders/${poId}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
