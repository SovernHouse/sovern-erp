const { test, expect } = require('@playwright/test');

const API_BASE = 'http://localhost:5000/api';

test.describe('System API', () => {
  let token;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: 'admin@floortrading.com',
        password: 'admin123',
      },
    });
    const body = await res.json();
    token = body.data.tokens.accessToken;
  });

  test('Health check returns OK', async ({ request }) => {
    const res = await request.get('http://localhost:5000/health');

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('OK');
  });

  test('Monitoring metrics (admin)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/monitoring/metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });

  test('Currency rates', async ({ request }) => {
    const res = await request.get(`${API_BASE}/currencies`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Webhook CRUD', async ({ request }) => {
    // List webhooks
    const listRes = await request.get(`${API_BASE}/webhooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBeTruthy();

    // Create webhook
    const createRes = await request.post(`${API_BASE}/webhooks`, {
      data: {
        event: 'order.created',
        url: 'https://example.com/webhook',
        active: true,
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(createRes.ok()).toBeTruthy();

    const createBody = await createRes.json();
    const webhookId = createBody.data.id;

    // Get webhook
    const getRes = await request.get(`${API_BASE}/webhooks/${webhookId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.ok()).toBeTruthy();

    // Update webhook
    const updateRes = await request.put(`${API_BASE}/webhooks/${webhookId}`, {
      data: {
        url: 'https://example.com/webhook-updated',
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(updateRes.ok()).toBeTruthy();

    // Delete webhook
    const deleteRes = await request.delete(`${API_BASE}/webhooks/${webhookId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.ok()).toBeTruthy();
  });

  test('Export entities list', async ({ request }) => {
    const res = await request.get(`${API_BASE}/exports`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Export CSV download', async ({ request }) => {
    const res = await request.get(`${API_BASE}/exports/customers?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('User CRUD (admin)', async ({ request }) => {
    // List users
    const listRes = await request.get(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const listBody = await listRes.json();
    expect(Array.isArray(listBody.data)).toBeTruthy();

    // Create user
    const createRes = await request.post(`${API_BASE}/users`, {
      data: {
        email: `user${Date.now()}@example.com`,
        password: 'testPassword123',
        firstName: 'Test',
        lastName: 'User',
        role: 'manager',
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(createRes.ok()).toBeTruthy();

    const createBody = await createRes.json();
    const userId = createBody.data.id;

    // Get user
    const getRes = await request.get(`${API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.ok()).toBeTruthy();

    // Update user
    const updateRes = await request.put(`${API_BASE}/users/${userId}`, {
      data: {
        firstName: 'Updated',
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(updateRes.ok()).toBeTruthy();

    // Delete user
    const deleteRes = await request.delete(`${API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.ok()).toBeTruthy();
  });

  test('Settings endpoints', async ({ request }) => {
    const res = await request.get(`${API_BASE}/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });
});
