const { test, expect } = require('@playwright/test');
const { initializeTestEnvironment, cleanupTestEnvironment, testData } = require('../helpers/setup');

const API_BASE = 'http://localhost:5000/api';

test.describe('Products API', () => {
  let token;

  test.beforeAll(async () => {
    const env = await initializeTestEnvironment();
    token = env.authTokens.admin;
  });

  test.afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test('List all products', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Get product by ID', async ({ request }) => {
    // First get list of products
    const listRes = await request.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = await listRes.json();

    if (listBody.data.length > 0) {
      const productId = listBody.data[0].id;

      // Get specific product
      const res = await request.get(`${API_BASE}/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.data.id).toBe(productId);
    }
  });

  test('Create product with category', async ({ request }) => {
    const uniqueSku = `SKU${Date.now()}`;
    const res = await request.post(`${API_BASE}/products`, {
      data: {
        name: 'Test Floor Tile',
        sku: uniqueSku,
        category: 'Ceramic Tiles',
        price: 29.99,
        unit: 'box',
        description: 'High-quality ceramic floor tile',
        manufacturer: 'Test Manufacturer',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.sku).toBe(uniqueSku);
    expect(body.data.category).toBe('Ceramic Tiles');
  });

  test('Update product', async ({ request }) => {
    // Create a product first
    const uniqueSku = `SKU${Date.now()}`;
    const createRes = await request.post(`${API_BASE}/products`, {
      data: {
        name: 'Test Floor Tile',
        sku: uniqueSku,
        category: 'Ceramic Tiles',
        price: 29.99,
        unit: 'box',
        description: 'High-quality ceramic floor tile',
        manufacturer: 'Test Manufacturer',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const productId = createBody.data.id;

    // Update the product
    const res = await request.put(`${API_BASE}/products/${productId}`, {
      data: {
        price: 34.99,
        description: 'Updated description',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.price).toBe(34.99);
  });

  test('Delete product', async ({ request }) => {
    // Create a product first
    const uniqueSku = `SKU${Date.now()}`;
    const createRes = await request.post(`${API_BASE}/products`, {
      data: {
        name: 'Test Floor Tile',
        sku: uniqueSku,
        category: 'Ceramic Tiles',
        price: 29.99,
        unit: 'box',
        description: 'High-quality ceramic floor tile',
        manufacturer: 'Test Manufacturer',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const productId = createBody.data.id;

    // Delete the product
    const res = await request.delete(`${API_BASE}/products/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('Search products', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products?search=tile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Get non-existent product returns 404', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products/nonexistentid`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBe(404);
  });
});
