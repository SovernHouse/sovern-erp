const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Customers Integration Tests', () => {
  let db, request, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  describe('POST /api/customers', () => {
    it('should create a customer', async () => {
      const response = await request
        .post('/api/customers')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Test Company',
          email: `customer-${uuidv4()}@example.com`,
          phone: '+1234567890',
          country: 'USA'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.isActive).toBe(true);
    });

    it('should require company name', async () => {
      const response = await request
        .post('/api/customers')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          email: `customer-${uuidv4()}@example.com`,
          phone: '+1234567890'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should require valid email', async () => {
      const response = await request
        .post('/api/customers')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Test Company',
          email: 'invalid-email',
          phone: '+1234567890'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should require authentication', async () => {
      const response = await request
        .post('/api/customers')
        .send({
          companyName: 'Test Company',
          email: `customer-${uuidv4()}@example.com`,
          phone: '+1234567890'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/customers', () => {
    it('should list customers', async () => {
      const response = await request
        .get('/api/customers')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request
        .get('/api/customers?page=1&limit=10')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.pageSize).toBe(10);
    });

    it('should filter by active status', async () => {
      const response = await request
        .get('/api/customers?isActive=true')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
    });

    it('should search by company name', async () => {
      const response = await request
        .get('/api/customers?search=Test')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/customers/:id', () => {
    let customerId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/customers')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Get Customer Test',
          email: `customer-${uuidv4()}@example.com`,
          phone: '+1234567890'
        }, 180000);

      customerId = response.body.data.id;
    }, 180000);

    it('should get customer by ID', async () => {
      const response = await request
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(customerId);
      expect(response.body.data.companyName).toBe('Get Customer Test');
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request
        .get(`/api/customers/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/customers/:id', () => {
    let customerId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/customers')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Update Customer Test',
          email: `customer-${uuidv4()}@example.com`,
          phone: '+1234567890'
        }, 180000);

      customerId = response.body.data.id;
    }, 180000);

    it('should update customer', async () => {
      const response = await request
        .put(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Updated Company Name',
          phone: '+0987654321',
          creditLimit: 50000
        });

      expect(response.status).toBe(200);
      expect(response.body.data.companyName).toBe('Updated Company Name');
      expect(response.body.data.phone).toBe('+0987654321');
    });

    it('should update partial fields', async () => {
      const response = await request
        .put(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          rating: 4.5
        });

      expect(response.status).toBe(200);
      expect(response.body.data.rating).toBe(4.5);
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request
        .put(`/api/customers/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'New Name'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/customers/:id', () => {
    let customerId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/customers')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          companyName: 'Delete Customer Test',
          email: `customer-${uuidv4()}@example.com`,
          phone: '+1234567890'
        }, 180000);

      customerId = response.body.data.id;
    }, 180000);

    it('should delete customer (soft delete)', async () => {
      const response = await request
        .delete(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request
        .delete(`/api/customers/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
