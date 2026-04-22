const { getApp, getRequest, cleanup } = require('../setup');

describe('Health Check Tests', () => {
  let request;

  beforeAll(async () => {
    await getApp();
    request = await getRequest();
  }, 30000);

  afterAll(async () => {
    await cleanup();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should be accessible without authentication', async () => {
      const response = await request
        .get('/api/health');

      expect(response.status).toBe(200);
    });
  });

  describe('404 Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request
        .get('/api/nonexistent-route');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });
});
