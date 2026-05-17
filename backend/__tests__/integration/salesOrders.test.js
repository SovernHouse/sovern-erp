const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Sales Orders Integration Tests', () => {
  let db, request, testData;
  let customer, factory, product, category;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();

    // Create additional test data for sales orders
    category = await db.ProductCategory.create({
      id: uuidv4(),
      name: 'Flooring'
    });

    customer = await db.Customer.create({
      id: uuidv4(),
      companyName: 'SO Test Customer',
      email: `so-customer-${uuidv4()}@example.com`,
      phone: '+1234567890'
    });

    factory = await db.Factory.create({
      id: uuidv4(),
      companyName: 'SO Test Factory',
      email: `so-factory-${uuidv4()}@example.com`,
      phone: '+1234567890'
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

  describe('POST /api/sales-orders', () => {
    it('should create a sales order with items', async () => {
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50,
              description: 'Laminate Flooring 8mm'
            }
          ],
          estimatedDelivery: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          shippingMethod: 'Sea'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('orderNumber');
      expect(response.body.data.status).toBe('confirmed');
      expect(response.body.data.paymentStatus).toBe('unpaid');
      expect(response.body.data.items.length).toBe(1);
      expect(response.body.data.subtotal).toBe(5000);
    });

    it('should calculate totals correctly', async () => {
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ],
          discount: 500,
          tax: 450
        });

      expect(response.status).toBe(201);
      expect(response.body.data.subtotal).toBe(5000);
      expect(response.body.data.discount).toBe(500);
      expect(response.body.data.tax).toBe(450);
      expect(response.body.data.total).toBe(4950); // 5000 - 500 + 450
    });

    it('should reject without customer ID', async () => {
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject without factory ID', async () => {
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject without items', async () => {
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: []
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject with invalid customer', async () => {
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: uuidv4(),
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ]
        });

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await request
        .post('/api/sales-orders')
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: []
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/sales-orders', () => {
    let salesOrderId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ]
        }, 180000);

      salesOrderId = response.body.data.id;
    }, 180000);

    it('should list sales orders', async () => {
      const response = await request
        .get('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request
        .get('/api/sales-orders?page=1&limit=5')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.pageSize).toBe(5);
    });

    it('should filter by status', async () => {
      const response = await request
        .get(`/api/sales-orders?status=confirmed`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].status).toBe('confirmed');
      }
    });

    it('should filter by customer ID', async () => {
      const response = await request
        .get(`/api/sales-orders?customerId=${customer.id}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].customerId).toBe(customer.id);
      }
    });

    it('should require authentication', async () => {
      const response = await request
        .get('/api/sales-orders');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/sales-orders/:id', () => {
    let salesOrderId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ]
        }, 180000);

      salesOrderId = response.body.data.id;
    }, 180000);

    it('should get sales order by ID', async () => {
      const response = await request
        .get(`/api/sales-orders/${salesOrderId}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(salesOrderId);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('customer');
      expect(response.body.data).toHaveProperty('factory');
    });

    it('should include associated items', async () => {
      const response = await request
        .get(`/api/sales-orders/${salesOrderId}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request
        .get(`/api/sales-orders/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/sales-orders/:id/status', () => {
    let salesOrderId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ]
        }, 180000);

      salesOrderId = response.body.data.id;
    }, 180000);

    it('should update sales order status', async () => {
      const response = await request
        .patch(`/api/sales-orders/${salesOrderId}/status`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          status: 'in_production'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('in_production');
    });

    it('should update item status when order is shipped', async () => {
      // State machine: in_production → ready → shipped (cannot skip ready)
      const readyResponse = await request
        .patch(`/api/sales-orders/${salesOrderId}/status`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({ status: 'ready' });
      expect(readyResponse.status).toBe(200);

      const response = await request
        .patch(`/api/sales-orders/${salesOrderId}/status`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({ status: 'shipped' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('shipped');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request
        .patch(`/api/sales-orders/${uuidv4()}/status`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          status: 'shipped'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/sales-orders/:id', () => {
    let salesOrderId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ]
        }, 180000);

      salesOrderId = response.body.data.id;
    }, 180000);

    it('should update sales order', async () => {
      const response = await request
        .put(`/api/sales-orders/${salesOrderId}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          discount: 250,
          tax: 300,
          shippingMethod: 'Air'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.discount).toBe(250);
      expect(response.body.data.tax).toBe(300);
    });

    it('should update order when discount/tax changes', async () => {
      const response = await request
        .put(`/api/sales-orders/${salesOrderId}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          discount: 0,
          tax: 0
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      // Verify the order data is returned
      expect(response.body.data.total).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request
        .put(`/api/sales-orders/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          discount: 100
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/sales-orders/:id', () => {
    let salesOrderId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ]
        }, 180000);

      salesOrderId = response.body.data.id;
    }, 180000);

    it('should cancel sales order (soft delete)', async () => {
      const response = await request
        .delete(`/api/sales-orders/${salesOrderId}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request
        .delete(`/api/sales-orders/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/sales-orders/:id/timeline', () => {
    let salesOrderId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ],
          estimatedDelivery: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }, 180000);

      salesOrderId = response.body.data.id;
    }, 180000);

    it('should get sales order timeline', async () => {
      const response = await request
        .get(`/api/sales-orders/${salesOrderId}/timeline`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should include creation date in timeline', async () => {
      const response = await request
        .get(`/api/sales-orders/${salesOrderId}/timeline`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.body.data[0].action).toBe('Order created');
    });
  });

  describe('GET /api/sales-orders/:id/documents', () => {
    let salesOrderId;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const response = await request
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          customerId: customer.id,
          factoryId: factory.id,
          items: [
            {
              productId: product.id,
              quantity: 100,
              unitPrice: 50
            }
          ]
        }, 180000);

      salesOrderId = response.body.data.id;
    }, 180000);

    it('should get sales order documents', async () => {
      const response = await request
        .get(`/api/sales-orders/${salesOrderId}/documents`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
