const { test, expect } = require('@playwright/test');

const API_BASE = 'http://localhost:5000/api';

test.describe('Dashboard API', () => {
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

  test('Get admin dashboard', async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });

  test('Get metrics', async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard/metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });

  test('Get recent orders', async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard/recent-orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Get top customers', async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard/top-customers`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Get revenue trend', async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard/revenue-trend`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });

  test('Get upcoming shipments', async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard/upcoming-shipments`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });
});
