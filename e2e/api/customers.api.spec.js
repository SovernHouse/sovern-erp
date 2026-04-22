const { test, expect } = require('@playwright/test');
const { initializeTestEnvironment, getToken, cleanupTestEnvironment, testData } = require('../helpers/setup');

const API_BASE = 'http://localhost:5000/api';

test.describe('Customers API', () => {
  let token;

  test.beforeAll(async () => {
    const env = await initializeTestEnvironment();
    token = env.authTokens.admin;
  });

  test.afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test('List all customers (authenticated)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('List customers without auth returns 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/customers`);
    expect(res.status()).toBe(401);
  });

  test('Get customer by ID', async ({ request }) => {
    // First get list of customers
    const listRes = await request.get(`${API_BASE}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = await listRes.json();

    if (listBody.data.length > 0) {
      const customerId = listBody.data[0].id;

      // Get specific customer
      const res = await request.get(`${API_BASE}/customers/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.data.id).toBe(customerId);
    }
  });

  test('Create new customer', async ({ request }) => {
    const uniqueEmail = `customer${Date.now()}@example.com`;
    const res = await request.post(`${API_BASE}/customers`, {
      data: {
        name: 'Test Customer',
        email: uniqueEmail,
        phone: '+1234567890',
        address: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.email).toBe(uniqueEmail);
  });

  test('Update customer', async ({ request }) => {
    // Create a customer first
    const uniqueEmail = `customer${Date.now()}@example.com`;
    const createRes = await request.post(`${API_BASE}/customers`, {
      data: {
        name: 'Test Customer',
        email: uniqueEmail,
        phone: '+1234567890',
        address: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const customerId = createBody.data.id;

    // Update the customer
    const res = await request.put(`${API_BASE}/customers/${customerId}`, {
      data: {
        name: 'Updated Customer Name',
        phone: '+9876543210',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.name).toBe('Updated Customer Name');
  });

  test('Delete customer', async ({ request }) => {
    // Create a customer first
    const uniqueEmail = `customer${Date.now()}@example.com`;
    const createRes = await request.post(`${API_BASE}/customers`, {
      data: {
        name: 'Test Customer',
        email: uniqueEmail,
        phone: '+1234567890',
        address: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const customerId = createBody.data.id;

    // Delete the customer
    const res = await request.delete(`${API_BASE}/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('Get non-existent customer returns 404', async ({ request }) => {
    const res = await request.get(`${API_BASE}/customers/nonexistentid`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBe(404);
  });

  test('Search customers with query params', async ({ request }) => {
    const res = await request.get(`${API_BASE}/customers?search=premium`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });
});
