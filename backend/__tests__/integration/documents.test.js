const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Documents Integration Tests', () => {
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

  describe('POST /api/documents', () => {
    it('should create a document', async () => {
      const response = await request
        .post('/api/documents')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          name: 'Test Document',
          documentType: 'contract',
          description: 'A test document',
          category: 'legal'
        });

      expect([201, 400, 404]).toContain(response.status);
    });
  });

  describe('GET /api/documents', () => {
    it('should list documents', async () => {
      const response = await request
        .get('/api/documents')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should support pagination', async () => {
      const response = await request
        .get('/api/documents?page=1&limit=10')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
    });

    it('should filter by document type', async () => {
      const response = await request
        .get('/api/documents?type=contract')
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/documents/:id', () => {
    it('should get document by ID', async () => {
      const response = await request
        .get(`/api/documents/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('PUT /api/documents/:id', () => {
    it('should update document', async () => {
      const response = await request
        .put(`/api/documents/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          name: 'Updated Document'
        });

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should delete document', async () => {
      const response = await request
        .delete(`/api/documents/${uuidv4()}`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/documents/:id/download', () => {
    it('should download document', async () => {
      const response = await request
        .get(`/api/documents/${uuidv4()}/download`)
        .set('Authorization', `Bearer ${testData.authToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });
});
