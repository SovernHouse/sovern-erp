/**
 * Shared E2E test setup and teardown
 * Provides centralized database initialization, auth tokens, and cleanup
 */

const jwt = require('jsonwebtoken');
const testData = require('./testData');

let db = null;
let app = null;
let server = null;
let isInitialized = false;

const authTokens = {
  admin: null,
  customer: null,
  factory: null,
  sales: null,
  operations: null,
  finance: null,
  inspector: null
};

const testUsers = {};

/**
 * Initialize E2E test environment
 */
const initializeTestEnvironment = async () => {
  if (isInitialized) return { db, app, authTokens, testUsers };

  // Set environment variables for test mode
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
  process.env.EMAIL_ENABLED = 'false'; // Disable email in tests
  process.env.RATE_LIMIT_MAX_REQUESTS = '10000';

  // Initialize database
  db = require('../backend/models');
  testData.initDb(db);

  // Get app instance
  const serverModule = require('../backend/server');
  app = serverModule.app;
  server = serverModule.server;

  // Sync database (force: true for test environment)
  await db.sequelize.sync({ force: true, logging: false });

  // Create test users and tokens
  const adminUser = await testData.createTestUser({
    email: 'admin@e2e.test',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  });

  const customerUser = await testData.createTestUser({
    email: 'customer@e2e.test',
    firstName: 'Customer',
    lastName: 'User',
    role: 'customer'
  });

  const factoryUser = await testData.createTestUser({
    email: 'factory@e2e.test',
    firstName: 'Factory',
    lastName: 'User',
    role: 'factory'
  });

  const salesUser = await testData.createTestUser({
    email: 'sales@e2e.test',
    firstName: 'Sales',
    lastName: 'User',
    role: 'sales'
  });

  const operationsUser = await testData.createTestUser({
    email: 'operations@e2e.test',
    firstName: 'Operations',
    lastName: 'User',
    role: 'operations'
  });

  const financeUser = await testData.createTestUser({
    email: 'finance@e2e.test',
    firstName: 'Finance',
    lastName: 'User',
    role: 'finance'
  });

  const inspectorUser = await testData.createTestUser({
    email: 'inspector@e2e.test',
    firstName: 'Inspector',
    lastName: 'User',
    role: 'inspector'
  });

  // Generate JWT tokens for each user
  authTokens.admin = jwt.sign(
    { id: adminUser.id, email: adminUser.email, role: adminUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  authTokens.customer = jwt.sign(
    { id: customerUser.id, email: customerUser.email, role: customerUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  authTokens.factory = jwt.sign(
    { id: factoryUser.id, email: factoryUser.email, role: factoryUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  authTokens.sales = jwt.sign(
    { id: salesUser.id, email: salesUser.email, role: salesUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  authTokens.operations = jwt.sign(
    { id: operationsUser.id, email: operationsUser.email, role: operationsUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  authTokens.finance = jwt.sign(
    { id: financeUser.id, email: financeUser.email, role: financeUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  authTokens.inspector = jwt.sign(
    { id: inspectorUser.id, email: inspectorUser.email, role: inspectorUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Store test users for reference
  testUsers.admin = adminUser;
  testUsers.customer = customerUser;
  testUsers.factory = factoryUser;
  testUsers.sales = salesUser;
  testUsers.operations = operationsUser;
  testUsers.finance = financeUser;
  testUsers.inspector = inspectorUser;

  isInitialized = true;

  return { db, app, authTokens, testUsers };
};

/**
 * Get current database instance
 */
const getDb = () => {
  if (!db) throw new Error('Test environment not initialized. Call initializeTestEnvironment() first.');
  return db;
};

/**
 * Get current app instance
 */
const getApp = () => {
  if (!app) throw new Error('Test environment not initialized. Call initializeTestEnvironment() first.');
  return app;
};

/**
 * Get auth token for a specific role
 */
const getToken = (role = 'admin') => {
  const token = authTokens[role];
  if (!token) throw new Error(`No auth token for role: ${role}`);
  return token;
};

/**
 * Get test user for a specific role
 */
const getTestUser = (role = 'admin') => {
  const user = testUsers[role];
  if (!user) throw new Error(`No test user for role: ${role}`);
  return user;
};

/**
 * Helper to make authorized API requests
 */
const makeRequest = (request, method, endpoint, role = 'admin') => {
  const token = getToken(role);
  const req = request[method.toLowerCase()](endpoint);
  return req.set('Authorization', `Bearer ${token}`);
};

/**
 * Clean up test environment
 */
const cleanupTestEnvironment = async () => {
  try {
    if (db && db.sequelize) {
      await db.sequelize.close();
    }
  } catch (error) {
    console.error('Error closing database:', error.message);
  }

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  } catch (error) {
    console.error('Error closing server:', error.message);
  }

  isInitialized = false;
  db = null;
  app = null;
  server = null;

  // Reset tokens
  Object.keys(authTokens).forEach((key) => {
    authTokens[key] = null;
  });
};

/**
 * Reset database between tests (without re-initializing app)
 */
const resetDatabase = async () => {
  if (!db) throw new Error('Test environment not initialized');
  await db.sequelize.sync({ force: true, logging: false });
};

module.exports = {
  initializeTestEnvironment,
  getDb,
  getApp,
  getToken,
  getTestUser,
  makeRequest,
  cleanupTestEnvironment,
  resetDatabase,
  testData
};
