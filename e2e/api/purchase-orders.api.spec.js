const { test, expect } = require('@playwright/test');

const API_BASE = 'http://localhost:5000/api';

test.describe('Purchase Orders API', () => {
  let token;
  let factoryId;
  let productId;

  test.beforeAll(async ({ request }) => {
    // Login
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: 'admin@floortrading.com',
        password: 'admin123',
      },
    });
    const loginBody = await loginRes.json();
    token = loginBody.data.tokens.accessToken;

    // Get or create a factory
    const factoriesRes = await request.get(`${API_BASE}/factories`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const factoriesBody = await factoriesRes.json();
    if (factoriesBody.data.length > 0) {
      factoryId = factoriesBody.data[0].id;
    } else {
      const createFactoryRes = await request.post(`${API_BASE}/factories`, {
        data: {
          name: 'Test Factory',
          email: `factory${Date.now()}@example.com`,
          phone: '+1234567890',
          address: '123 Factory St',
          city: 'Factory City',
          state: 'FS',
          zipCode: '54321',
          country: 'Test Country',
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const factoryBody = await createFactoryRes.json();
      factoryId = factoryBody.data.id;
    }

    // Get or create a product
    const productsRes = await request.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const productsBody = await productsRes.json();
    if (productsBody.data.length > 0) {
      productId = productsBody.data[0].id;
    } else {
      const createProductRes = await request.post(`${API_BASE}/products`, {
        data: {
          name: 'Test Product',
          sku: `SKU${Date.now()}`,
          category: 'Tiles',
          price: 15.99,
          unit: 'box',
          description: 'Test product',
          manufacturer: 'Test Manufacturer',
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const productBody = await createProductRes.json();
      productId = productBody.data.id;
    }
  });

  test('List purchase orders', async ({ request }) => {
    const res = await request.get(`${API_BASE}/purchase-orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Create purchase order', async ({ request }) => {
    const res = await request.post(`${API_BASE}/purchase-orders`, {
      data: {
        factoryId,
        poNumber: `PO${Date.now()}`,
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 100,
            unitPrice: 15.99,
          },
        ],
        totalAmount: 1599.00,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.factoryId).toBe(factoryId);
  });

  test('Get PO by ID', async ({ request }) => {
    // Create a PO first
    const createRes = await request.post(`${API_BASE}/purchase-orders`, {
      data: {
        factoryId,
        poNumber: `PO${Date.now()}`,
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 50,
            unitPrice: 15.99,
          },
        ],
        totalAmount: 799.50,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const poId = createBody.data.id;

    // Get the PO
    const res = await request.get(`${API_BASE}/purchase-orders/${poId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.id).toBe(poId);
  });

  test('Confirm PO', async ({ request }) => {
    // Create a PO first
    const createRes = await request.post(`${API_BASE}/purchase-orders`, {
      data: {
        factoryId,
        poNumber: `PO${Date.now()}`,
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 75,
            unitPrice: 15.99,
          },
        ],
        totalAmount: 1199.25,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const poId = createBody.data.id;

    // Confirm the PO
    const res = await request.post(`${API_BASE}/purchase-orders/${poId}/confirm`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.status).toBe('confirmed');
  });

  test('Update PO status', async ({ request }) => {
    // Create a PO first
    const createRes = await request.post(`${API_BASE}/purchase-orders`, {
      data: {
        factoryId,
        poNumber: `PO${Date.now()}`,
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 25,
            unitPrice: 15.99,
          },
        ],
        totalAmount: 399.75,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const poId = createBody.data.id;

    // Update status
    const res = await request.patch(`${API_BASE}/purchase-orders/${poId}/status`, {
      data: {
        status: 'shipped',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.status).toBe('shipped');
  });

  test('Delete PO', async ({ request }) => {
    // Create a PO first
    const createRes = await request.post(`${API_BASE}/purchase-orders`, {
      data: {
        factoryId,
        poNumber: `PO${Date.now()}`,
        orderDate: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: 10,
            unitPrice: 15.99,
          },
        ],
        totalAmount: 159.90,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const poId = createBody.data.id;

    // Delete the PO
    const res = await request.delete(`${API_BASE}/purchase-orders/${poId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('List POs with filters', async ({ request }) => {
    const res = await request.get(`${API_BASE}/purchase-orders?status=pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });
});
