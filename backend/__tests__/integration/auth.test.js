const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Auth Integration Tests', () => {
  let db, request, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request
        .post('/api/auth/register')
        .send({
          email: `register-${uuidv4()}@example.com`,
          password: 'Password@123',
          firstName: 'John',
          lastName: 'Doe'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.user.email).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should not register user with duplicate email', async () => {
      const email = `duplicate-${uuidv4()}@example.com`;

      await request
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password@123',
          firstName: 'John',
          lastName: 'Doe'
        });

      const response = await request
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password@123',
          firstName: 'Jane',
          lastName: 'Doe'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with invalid email', async () => {
      const response = await request
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'Password@123',
          firstName: 'John',
          lastName: 'Doe'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with short password', async () => {
      const response = await request
        .post('/api/auth/register')
        .send({
          email: `short-${uuidv4()}@example.com`,
          password: '123',
          firstName: 'John',
          lastName: 'Doe'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with missing fields', async () => {
      const response = await request
        .post('/api/auth/register')
        .send({
          email: `test-${uuidv4()}@example.com`,
          password: 'Password@123'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    let testEmail, testPassword;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      testEmail = `login-test-${uuidv4()}@example.com`;
      testPassword = 'TestPassword@123';

      await request
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          firstName: 'Login',
          lastName: 'Test'
        }, 180000);
    }, 180000);

    it('should login successfully with correct credentials', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens.accessToken).toBeDefined();
    }, 180000);

    it('should reject login with wrong password', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword@123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid');
    });

    it('should reject login for non-existent user', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: `nonexistent-${uuidv4()}@example.com`,
          password: 'Password@123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login with invalid email format', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: testPassword
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject login with missing password', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: testEmail
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;
    let testEmail = `me-test-${uuidv4()}@example.com`;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const registerResponse = await request
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'TestPassword@123',
          firstName: 'Me',
          lastName: 'Test'
        }, 180000);

      authToken = registerResponse.body.data.tokens.accessToken;
    }, 180000);

    it('should get current user with valid token', async () => {
      const response = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testEmail);
      expect(response.body.data.firstName).toBe('Me');
    }, 180000);

    it('should not return password in response', async () => {
      const response = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.resetToken).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const response = await request
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/auth/profile', () => {
    let authToken;
    let testEmail = `profile-test-${uuidv4()}@example.com`;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const registerResponse = await request
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'TestPassword@123',
          firstName: 'Original',
          lastName: 'Name'
        }, 180000);

      authToken = registerResponse.body.data.tokens.accessToken;
    }, 180000);

    it('should update profile with valid data', async () => {
      const response = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
          phone: '+1234567890'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('Updated');
      expect(response.body.data.phone).toBe('+1234567890');
    }, 180000);

    it('should update only provided fields', async () => {
      const response = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Partial'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.firstName).toBe('Partial');
      expect(response.body.data.lastName).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request
        .put('/api/auth/profile')
        .send({
          firstName: 'Hacker'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    let authToken;
    let testEmail = `password-test-${uuidv4()}@example.com`;
    const oldPassword = 'OldPassword@123';
    const newPassword = 'NewPassword@456';

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      const registerResponse = await request
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: oldPassword,
          firstName: 'Password',
          lastName: 'Test'
        }, 180000);

      authToken = registerResponse.body.data.tokens.accessToken;
    }, 180000);

    it('should change password successfully', async () => {
      const response = await request
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: oldPassword,
          newPassword: newPassword
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }, 180000);

    it('should allow login with new password', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: newPassword
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject change with incorrect current password', async () => {
      const response = await request
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'WrongPassword@123',
          newPassword: 'AnotherPassword@789'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request
        .post('/api/auth/change-password')
        .send({
          currentPassword: oldPassword,
          newPassword: 'NewPassword@123'
        });

      expect(response.status).toBe(401);
    });

    it('should reject change with short new password', async () => {
      const response = await request
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: newPassword,
          newPassword: '123'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    let testEmail = `forgot-${uuidv4()}@example.com`;

    beforeAll(async () => {
      if (!request) { await getApp(); request = await getRequest(); }
      await request
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'TestPassword@123',
          firstName: 'Forgot',
          lastName: 'Test'
        }, 180000);
    }, 180000);

    it('should return success message for existing email', async () => {
      const response = await request
        .post('/api/auth/forgot-password')
        .send({
          email: testEmail
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }, 180000);

    it('should return success message for non-existing email (security)', async () => {
      const response = await request
        .post('/api/auth/forgot-password')
        .send({
          email: `nonexistent-${uuidv4()}@example.com`
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid email format', async () => {
      const response = await request
        .post('/api/auth/forgot-password')
        .send({
          email: 'not-an-email'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
