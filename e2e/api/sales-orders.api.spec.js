const { test, expect } = require('@playwright/test');
const { initializeTestEnvironment, cleanupTestEnvironment, testData, getDb } = require('../helpers/setup');

const API_BASE = 'http://localhost:5000/api';

test.describe('Sales Orders API', () => {
  let token;
  let customerId;
  let productId;
  let db;

  test.beforeAll(async () => {
    const env = await initializeTestEnvironment();
    db = env.db;
    token = env.authTokens.admin;

    // Create test customer and product
    const customer = await testData.createTestCustomer();
    customerId = customer.id;

    const product = await testData.createTestProduct();
    productId = product.id;
  });

  test.afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test('List all sales orders', async ({ request }) => {
    const res = await request.get(`${API_BASE}/sales-orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Create sales order with items', async ({ request }) => {
    const res = await request.post(`${API_BASE}/sales-orders`, {
      data: {
        customerId,
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 10,
            unitPrice: 29.99,
          },
        ],
        totalAmount: 299.90,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.customerId).toBe(customerId);
    expect(body.data.items.length).toBeGreaterThan(0);
  });

  test('Get sales order by ID', async ({ request }) => {
    // Create an order first
    const createRes = await request.post(`${API_BASE}/sales-orders`, {
      data: {
        customerId,
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 5,
            unitPrice: 29.99,
          },
        ],
        totalAmount: 149.95,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const orderId = createBody.data.id;

    // Get the order
    const res = await request.get(`${API_BASE}/sales-orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.id).toBe(orderId);
  });

  test('Update sales order', async ({ request }) => {
    // Create an order first
    const createRes = await request.post(`${API_BASE}/sales-orders`, {
      data: {
        customerId,
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 8,
            unitPrice: 29.99,
          },
        ],
        totalAmount: 239.92,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const orderId = createBody.data.id;

    // Update the order
    const res = await request.put(`${API_BASE}/sales-orders/${orderId}`, {
      data: {
        totalAmount: 329.89,
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('Change order status', async ({ request }) => {
    // Create an order first
    const createRes = await request.post(`${API_BASE}/sales-orders`, {
      data: {
        customerId,
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 3,
            unitPrice: 29.99,
          },
        ],
        totalAmount: 89.97,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const orderId = createBody.data.id;

    // Change status
    const res = await request.patch(`${API_BASE}/sales-orders/${orderId}/status`, {
      data: {
        status: 'confirmed',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.status).toBe('confirmed');
  });

  test('Create order without items fails validation', async ({ request }) => {
    const res = await request.post(`${API_BASE}/sales-orders`, {
      data: {
        customerId,
        orderDate: new Date().toISOString(),
        items: [],
        totalAmount: 0,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('Create order for non-existent customer fails', async ({ request }) => {
    const res = await request.post(`${API_BASE}/sales-orders`, {
      data: {
        customerId: 'nonexistentid',
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 5,
            unitPrice: 29.99,
          },
        ],
        totalAmount: 149.95,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('Delete sales order', async ({ request }) => {
    // Create an order first
    const createRes = await request.post(`${API_BASE}/sales-orders`, {
      data: {
        customerId,
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 2,
            unitPrice: 29.99,
          },
        ],
        totalAmount: 59.98,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const orderId = createBody.data.id;

    // Delete the order
    const res = await request.delete(`${API_BASE}/sales-orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('List orders with status filter', async ({ request }) => {
    const res = await request.get(`${API_BASE}/sales-orders?status=pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('List orders with date range filter', async ({ request }) => {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    const res = await request.get(
      `${API_BASE}/sales-orders?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });
});
