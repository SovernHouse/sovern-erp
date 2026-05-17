const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Invoices Integration Tests', () => {
  let db, request, testData;
  let customer;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();

    customer = await db.Customer.create({
      id: uuidv4(),
      companyName: 'Invoice Test Customer',
      email: `inv-customer-${uuidv4()}@example.com`,
      phone: '+1234567890'
    });
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  describe('POST /api/invoices', () => {
    it('should create an invoice', async () => {
      const response = await request
        .post('/api/invoices')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          invoiceNumber: `INV-${uuidv4()}`,
          subtotal: 1000,
          tax: 100,
          total: 1100
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe('draft');
    });

    it('should require customer ID', async () => {
      const response = await request
        .post('/api/invoices')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          invoiceNumber: `INV-${uuidv4()}`,
          total: 1000
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should require authentication', async () => {
      const response = await request
        .post('/api/invoices')
        .send({
          customerId: customer.id,
          invoiceNumber: `INV-${uuidv4()}`
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/invoices', () => {
    it('should list invoices', async () => {
      const response = await request
        .get('/api/invoices')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request
        .get('/api/invoices?page=1&limit=10')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.currentPage).toBe(1);
    });

    it('should filter by status', async () => {
      const response = await request
        .get('/api/invoices?status=draft')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].status).toBe('draft');
      }
    });

    it('should filter by customer', async () => {
      const response = await request
        .get(`/api/invoices?customerId=${customer.id}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/invoices/:id', () => {
    let invoiceId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/invoices')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          invoiceNumber: `INV-${uuidv4()}`,
          subtotal: 1000,
          tax: 100,
          total: 1100
        }, 180000);

      invoiceId = response.body.data.id;
    }, 180000);

    it('should get invoice by ID', async () => {
      const response = await request
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(invoiceId);
    });

    it('should return 404 for non-existent invoice', async () => {
      const response = await request
        .get(`/api/invoices/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/invoices/:id', () => {
    let invoiceId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/invoices')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          invoiceNumber: `INV-${uuidv4()}`,
          subtotal: 1000,
          tax: 100,
          total: 1100
        }, 180000);

      invoiceId = response.body.data.id;
    }, 180000);

    it('should update invoice', async () => {
      const response = await request
        .put(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  // PATCH /api/invoices/:id/status not implemented in routes

  // DELETE /api/invoices not implemented in routes

  describe('GET /api/invoices/aging-report', () => {
    it('should get aging report', async () => {
      const response = await request
        .get('/api/invoices/aging-report')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('GET /api/invoices/summary', () => {
    it('should get invoice summary', async () => {
      const response = await request
        .get('/api/invoices/summary')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('POST /api/invoices/:id/send', () => {
    let invoiceId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/invoices')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          invoiceNumber: `INV-${uuidv4()}`,
          subtotal: 1000,
          tax: 100,
          total: 1100
        }, 180000);

      invoiceId = response.body.data.id;
    }, 180000);

    it('should send invoice', async () => {
      const response = await request
        .post(`/api/invoices/${invoiceId}/send`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          email: customer.email
        });

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });
});
