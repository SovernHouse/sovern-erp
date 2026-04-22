const { test, expect } = require('@playwright/test');

const API_BASE = 'http://localhost:5000/api';

test.describe('Shipments API', () => {
  let token;
  let salesOrderId;

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

    // Get or create a customer
    const customersRes = await request.get(`${API_BASE}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const customersBody = await customersRes.json();
    let customerId = customersBody.data[0]?.id;

    if (!customerId) {
      const createRes = await request.post(`${API_BASE}/customers`, {
        data: {
          name: 'Shipment Test Customer',
          email: `customer${Date.now()}@example.com`,
          phone: '+1234567890',
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country',
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const customerBody = await createRes.json();
      customerId = customerBody.data.id;
    }

    // Get or create a product
    const productsRes = await request.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const productsBody = await productsRes.json();
    let productId = productsBody.data[0]?.id;

    if (!productId) {
      const createProductRes = await request.post(`${API_BASE}/products`, {
        data: {
          name: 'Test Product',
          sku: `SKU${Date.now()}`,
          category: 'Tiles',
          price: 29.99,
          unit: 'box',
          description: 'Test product',
          manufacturer: 'Test Manufacturer',
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const productBody = await createProductRes.json();
      productId = productBody.data.id;
    }

    // Create a sales order for shipment
    const orderRes = await request.post(`${API_BASE}/sales-orders`, {
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
        status: 'confirmed',
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    const orderBody = await orderRes.json();
    salesOrderId = orderBody.data.id;
  });

  test('List shipments', async ({ request }) => {
    const res = await request.get(`${API_BASE}/shipments`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Create shipment', async ({ request }) => {
    const res = await request.post(`${API_BASE}/shipments`, {
      data: {
        salesOrderId,
        shipmentDate: new Date().toISOString(),
        carrier: 'FedEx',
        trackingNumber: `TRACK${Date.now()}`,
        items: [
          {
            productId: '1',
            quantity: 10,
          },
        ],
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.salesOrderId).toBe(salesOrderId);
  });

  test('Get shipment by ID', async ({ request }) => {
    // Create a shipment first
    const createRes = await request.post(`${API_BASE}/shipments`, {
      data: {
        salesOrderId,
        shipmentDate: new Date().toISOString(),
        carrier: 'DHL',
        trackingNumber: `TRACK${Date.now()}`,
        items: [
          {
            productId: '1',
            quantity: 5,
          },
        ],
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const shipmentId = createBody.data.id;

    // Get the shipment
    const res = await request.get(`${API_BASE}/shipments/${shipmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.id).toBe(shipmentId);
  });

  test('Update tracking info', async ({ request }) => {
    // Create a shipment first
    const createRes = await request.post(`${API_BASE}/shipments`, {
      data: {
        salesOrderId,
        shipmentDate: new Date().toISOString(),
        carrier: 'UPS',
        trackingNumber: `TRACK${Date.now()}`,
        items: [
          {
            productId: '1',
            quantity: 8,
          },
        ],
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const shipmentId = createBody.data.id;

    // Update tracking
    const res = await request.patch(`${API_BASE}/shipments/${shipmentId}/tracking`, {
      data: {
        trackingNumber: `UPDATED${Date.now()}`,
        carrier: 'USPS',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('Update shipment status', async ({ request }) => {
    // Create a shipment first
    const createRes = await request.post(`${API_BASE}/shipments`, {
      data: {
        salesOrderId,
        shipmentDate: new Date().toISOString(),
        carrier: 'FedEx',
        trackingNumber: `TRACK${Date.now()}`,
        items: [
          {
            productId: '1',
            quantity: 12,
          },
        ],
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const shipmentId = createBody.data.id;

    // Update status
    const res = await request.patch(`${API_BASE}/shipments/${shipmentId}/status`, {
      data: {
        status: 'shipped',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.status).toBe('shipped');
  });

  test('Delete shipment', async ({ request }) => {
    // Create a shipment first
    const createRes = await request.post(`${API_BASE}/shipments`, {
      data: {
        salesOrderId,
        shipmentDate: new Date().toISOString(),
        carrier: 'DHL',
        trackingNumber: `TRACK${Date.now()}`,
        items: [
          {
            productId: '1',
            quantity: 3,
          },
        ],
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const shipmentId = createBody.data.id;

    // Delete the shipment
    const res = await request.delete(`${API_BASE}/shipments/${shipmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });
});
