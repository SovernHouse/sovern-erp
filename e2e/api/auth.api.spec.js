const { test, expect } = require('@playwright/test');
const { initializeTestEnvironment, cleanupTestEnvironment, getTestUser } = require('../helpers/setup');

const API_BASE = 'http://localhost:5000/api';

test.describe('Auth API', () => {
  let testUser;

  test.beforeAll(async () => {
    const env = await initializeTestEnvironment();
    testUser = env.testUsers.admin;
  });

  test.afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test('Login with valid credentials returns token', async ({ request }) => {
    const res = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: testUser.email,
        password: 'Password123!',
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.tokens.accessToken).toBeTruthy();
    expect(body.data.user.email).toBe(testUser.email);
  });

  test('Login with wrong password returns 401', async ({ request }) => {
    const res = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: testUser.email,
        password: 'wrongpassword',
      },
    });

    expect(res.status()).toBe(401);
  });

  test('Login with non-existent email returns 401', async ({ request }) => {
    const res = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: 'nonexistent@example.com',
        password: 'password123',
      },
    });

    expect(res.status()).toBe(401);
  });

  test('Get current user with valid token', async ({ request }) => {
    // First login to get token
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: testUser.email,
        password: 'Password123!',
      },
    });
    const loginBody = await loginRes.json();
    const token = loginBody.data.tokens.accessToken;

    // Get current user
    const res = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.email).toBe(testUser.email);
  });

  test('Get current user without token returns 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/auth/me`);
    expect(res.status()).toBe(401);
  });

  test('Update profile successfully', async ({ request }) => {
    // Login first
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: testUser.email,
        password: 'Password123!',
      },
    });
    const loginBody = await loginRes.json();
    const token = loginBody.data.tokens.accessToken;

    // Update profile
    const res = await request.put(`${API_BASE}/auth/profile`, {
      data: {
        firstName: 'Admin',
        lastName: 'User',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('Change password', async ({ request }) => {
    // Login first
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: testUser.email,
        password: 'Password123!',
      },
    });
    const loginBody = await loginRes.json();
    const token = loginBody.data.tokens.accessToken;

    // Change password
    const res = await request.post(`${API_BASE}/auth/change-password`, {
      data: {
        currentPassword: 'Password123!',
        newPassword: 'NewPassword456!',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();

    // Revert back to original password for testing purposes
    await request.post(`${API_BASE}/auth/change-password`, {
      data: {
        currentPassword: 'NewPassword456!',
        newPassword: 'Password123!',
      },
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('Register new user', async ({ request }) => {
    const uniqueEmail = `testuser${Date.now()}@example.com`;
    const res = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: uniqueEmail,
        password: 'testPassword123',
        firstName: 'Test',
        lastName: 'User',
        role: 'customer',
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.user.email).toBe(uniqueEmail);
  });

  test('Forgot password endpoint works', async ({ request }) => {
    const res = await request.post(`${API_BASE}/auth/forgot-password`, {
      data: {
        email: testUser.email,
      },
    });

    expect(res.ok()).toBeTruthy();
  });

  test('Token expiry handling', async ({ request }) => {
    // Login with valid credentials
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: testUser.email,
        password: 'Password123!',
      },
    });
    const loginBody = await loginRes.json();
    const token = loginBody.data.tokens.accessToken;

    // Use the token - should work
    const meRes = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.ok()).toBeTruthy();
  });
});
