const { test, expect } = require('@playwright/test');

const API_BASE = 'http://localhost:5000/api';

test.describe('Reports API', () => {
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

  test('Sales report', async ({ request }) => {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    const res = await request.get(
      `${API_BASE}/reports/sales?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });

  test('Financial report', async ({ request }) => {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    const res = await request.get(
      `${API_BASE}/reports/financial?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });

  test('Customer report', async ({ request }) => {
    const res = await request.get(`${API_BASE}/reports/customers`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Inventory report', async ({ request }) => {
    const res = await request.get(`${API_BASE}/reports/inventory`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });

  test('Profit margin report', async ({ request }) => {
    const res = await request.get(`${API_BASE}/reports/profit-margin`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });

  test('Export report as CSV', async ({ request }) => {
    const res = await request.get(`${API_BASE}/reports/sales?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });
});
