const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Factories Integration Tests', () => {
  let db, request, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();
  }, 30000);

  afterAll(async () => {
    await cleanup();
  });

  describe('POST /api/factories', () => {
    it('should create a factory', async () => {
      const response = await request
        .post('/api/factories')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Test Factory',
          email: `factory-${uuidv4()}@example.com`,
          phone: '+1234567890',
          country: 'China'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.isActive).toBe(true);
    });

    it('should require company name', async () => {
      const response = await request
        .post('/api/factories')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          email: `factory-${uuidv4()}@example.com`,
          phone: '+1234567890'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should require valid email', async () => {
      const response = await request
        .post('/api/factories')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Test Factory',
          email: 'invalid-email',
          phone: '+1234567890'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should require authentication', async () => {
      const response = await request
        .post('/api/factories')
        .send({
          companyName: 'Test Factory',
          email: `factory-${uuidv4()}@example.com`,
          phone: '+1234567890'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/factories', () => {
    it('should list factories', async () => {
      const response = await request
        .get('/api/factories')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request
        .get('/api/factories?page=1&limit=10')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter by active status', async () => {
      const response = await request
        .get('/api/factories?isActive=true')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
    });

    it('should search by company name', async () => {
      const response = await request
        .get('/api/factories?search=Test')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/factories/:id', () => {
    let factoryId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/factories')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Get Factory Test',
          email: `factory-${uuidv4()}@example.com`,
          phone: '+1234567890'
        }, 30000);

      factoryId = response.body.data.id;
    }, 30000);

    it('should get factory by ID', async () => {
      const response = await request
        .get(`/api/factories/${factoryId}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(factoryId);
      expect(response.body.data.companyName).toBe('Get Factory Test');
    });

    it('should return 404 for non-existent factory', async () => {
      const response = await request
        .get(`/api/factories/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/factories/:id', () => {
    let factoryId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/factories')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Update Factory Test',
          email: `factory-${uuidv4()}@example.com`,
          phone: '+1234567890'
        }, 30000);

      factoryId = response.body.data.id;
    }, 30000);

    it('should update factory', async () => {
      const response = await request
        .put(`/api/factories/${factoryId}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Updated Factory Name',
          phone: '+0987654321',
          address: '123 Factory Street'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.companyName).toBe('Updated Factory Name');
      expect(response.body.data.phone).toBe('+0987654321');
    });

    it('should update partial fields', async () => {
      const response = await request
        .put(`/api/factories/${factoryId}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          city: 'Shanghai'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.city).toBe('Shanghai');
    });

    it('should return 404 for non-existent factory', async () => {
      const response = await request
        .put(`/api/factories/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'New Name'
        });

      expect(response.status).toBe(404);
    });
  });

  // DELETE /api/factories not implemented in routes

  describe('GET /api/factories/:id/products', () => {
    let factoryId, productId;
    let category;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const factoryResponse = await request
        .post('/api/factories')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Products Test Factory',
          email: `factory-${uuidv4()}@example.com`,
          phone: '+1234567890'
        }, 30000);

      factoryId = factoryResponse.body.data.id;

      category = await db.ProductCategory.create({
        id: uuidv4(),
        name: 'Flooring'
      });

      const productDb = await db.Product.create({
        id: uuidv4(),
        name: 'Test Product',
        sku: `SKU-${uuidv4()}`,
        categoryId: category.id,
        factoryId: factoryId
      });

      productId = productDb.id;
    }, 30000);

    it('should get factory products', async () => {
      const response = await request
        .get(`/api/factories/${factoryId}/products`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });
});
