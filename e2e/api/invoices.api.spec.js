const { test, expect } = require('@playwright/test');
const { initializeTestEnvironment, cleanupTestEnvironment, testData } = require('../helpers/setup');

const API_BASE = 'http://localhost:5000/api';

test.describe('Invoices API', () => {
  let token;
  let customerId;
  let salesOrderId;

  test.beforeAll(async () => {
    const env = await initializeTestEnvironment();
    token = env.authTokens.admin;

    // Create test data
    const customer = await testData.createTestCustomer();
    customerId = customer.id;

    const so = await testData.createTestSalesOrder({ customerId });
    salesOrderId = so.id;
  });

  test.afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test('List invoices', async ({ request }) => {
    const res = await request.get(`${API_BASE}/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Create invoice', async ({ request }) => {
    const res = await request.post(`${API_BASE}/invoices`, {
      data: {
        salesOrderId,
        customerId,
        invoiceNumber: `INV${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 299.90,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.customerId).toBe(customerId);
  });

  test('Get invoice by ID', async ({ request }) => {
    // Create an invoice first
    const createRes = await request.post(`${API_BASE}/invoices`, {
      data: {
        salesOrderId,
        customerId,
        invoiceNumber: `INV${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 299.90,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const invoiceId = createBody.data.id;

    // Get the invoice
    const res = await request.get(`${API_BASE}/invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.id).toBe(invoiceId);
  });

  test('Record payment', async ({ request }) => {
    // Create an invoice first
    const createRes = await request.post(`${API_BASE}/invoices`, {
      data: {
        salesOrderId,
        customerId,
        invoiceNumber: `INV${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 299.90,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const invoiceId = createBody.data.id;

    // Record payment
    const res = await request.post(`${API_BASE}/invoices/${invoiceId}/payment`, {
      data: {
        amount: 299.90,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'bank_transfer',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.status).toBe('paid');
  });

  test('Update invoice', async ({ request }) => {
    // Create an invoice first
    const createRes = await request.post(`${API_BASE}/invoices`, {
      data: {
        salesOrderId,
        customerId,
        invoiceNumber: `INV${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 299.90,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const invoiceId = createBody.data.id;

    // Update the invoice
    const res = await request.put(`${API_BASE}/invoices/${invoiceId}`, {
      data: {
        totalAmount: 350.00,
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('Get overdue invoices', async ({ request }) => {
    const res = await request.get(`${API_BASE}/invoices?status=overdue`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Delete invoice', async ({ request }) => {
    // Create an invoice first
    const createRes = await request.post(`${API_BASE}/invoices`, {
      data: {
        salesOrderId,
        customerId,
        invoiceNumber: `INV${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 299.90,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const invoiceId = createBody.data.id;

    // Delete the invoice
    const res = await request.delete(`${API_BASE}/invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('Invoice PDF endpoint', async ({ request }) => {
    // Create an invoice first
    const createRes = await request.post(`${API_BASE}/invoices`, {
      data: {
        salesOrderId,
        customerId,
        invoiceNumber: `INV${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 299.90,
        status: 'pending',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const createBody = await createRes.json();
    const invoiceId = createBody.data.id;

    // Get PDF
    const res = await request.get(`${API_BASE}/invoices/${invoiceId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });
});
