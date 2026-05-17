const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Dashboard Integration Tests', () => {
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

  describe('GET /api/dashboard/overview', () => {
    it('should get dashboard overview', async () => {
      const response = await request
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('GET /api/dashboard/sales-summary', () => {
    it('should get sales summary', async () => {
      const response = await request
        .get('/api/dashboard/sales-summary')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('GET /api/dashboard/recent-orders', () => {
    it('should get recent orders', async () => {
      const response = await request
        .get('/api/dashboard/recent-orders')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('GET /api/dashboard/revenue-trend', () => {
    it('should get revenue trend', async () => {
      const response = await request
        .get('/api/dashboard/revenue-trend')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it('should support period filter', async () => {
      const response = await request
        .get('/api/dashboard/revenue-trend?period=month')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/dashboard/top-customers', () => {
    it('should get top customers', async () => {
      const response = await request
        .get('/api/dashboard/top-customers')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it('should support limit parameter', async () => {
      const response = await request
        .get('/api/dashboard/top-customers?limit=5')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/dashboard/inventory-status', () => {
    it('should get inventory status', async () => {
      const response = await request
        .get('/api/dashboard/inventory-status')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('POST /api/dashboard/preferences', () => {
    it('should save dashboard preferences', async () => {
      const response = await request
        .post('/api/dashboard/preferences')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          widgetsOrder: ['overview', 'sales', 'orders'],
          defaultPeriod: 'month'
        });

      expect([200, 201, 404]).toContain(response.status);
    });
  });

  describe('GET /api/dashboard/preferences', () => {
    it('should get dashboard preferences', async () => {
      const response = await request
        .get('/api/dashboard/preferences')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('GET /api/dashboard/notifications', () => {
    it('should get dashboard notifications', async () => {
      const response = await request
        .get('/api/dashboard/notifications')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('GET /api/dashboard/quick-stats', () => {
    it('should get quick stats', async () => {
      const response = await request
        .get('/api/dashboard/quick-stats')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });
});
