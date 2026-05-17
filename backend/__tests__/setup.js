// MUST set env vars BEFORE any require that touches config/auth.js
process.env.NODE_ENV = 'test';
// CRITICAL: unset SQLITE_STORAGE before any require touches sequelize.
// If .env carries SQLITE_STORAGE=.../data/erp.db (prod), config/database.js
// honours it even in NODE_ENV=test, and sequelize.sync({force:true}) below
// would wipe production. delete forces the config to fall back to :memory:
// for test runs. (Macbook session 2026-05-17 caught this when the
// SQLITE_STORAGE in .env pointed at /home/alex/sovern-erp/data/erp.db with
// 116 tables and live customer/factory/product rows.)
delete process.env.SQLITE_STORAGE;

// L-058: getApp() takes ~13.6s for require + ~10s for sync({force:true})
// in this environment. Default Jest beforeAll timeout is 5s; we set the
// per-hook timeout to 90s globally so every integration test has room
// to boot the express app + sync the in-memory SQLite without flaking.
jest.setTimeout(180000);


process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-67890';
process.env.RATE_LIMIT_MAX_REQUESTS = '10000';

const request = require('supertest');

let appInstance = null;
let serverInstance = null;
let dbInstance = null;
let isReady = false;

const getApp = async () => {
  if (isReady) return appInstance;
  const serverModule = require('../server');
  appInstance = serverModule.app;
  serverInstance = serverModule.server;
  dbInstance = require('../models');
  await dbInstance.sequelize.sync({ force: true });
  isReady = true;
  return appInstance;
};

const getDb = () => {
  if (!dbInstance) dbInstance = require('../models');
  return dbInstance;
};

const getRequest = async () => {
  const app = await getApp();
  return request(app);
};

const seedTestData = async () => {
  const db = getDb();
  const { v4: uuidv4 } = require('uuid');
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');

  const adminId = uuidv4();
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await db.User.create({
    id: adminId, email: 'admin@test.com', password: hashedPassword,
    firstName: 'Test', lastName: 'Admin', role: 'admin', isActive: true
  });

  const authToken = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET, { expiresIn: '24h' }
  );

  const customer = await db.Customer.create({
    id: uuidv4(), companyName: 'Test Customer Corp', email: 'customer@test.com',
    phone: '+1234567890', contactPerson: 'Jane Smith', country: 'USA',
    currency: 'USD', paymentTerms: 'Net 30', isActive: true
  });

  const factory = await db.Factory.create({
    id: uuidv4(), companyName: 'Test Factory Ltd', email: 'factory@test.com',
    phone: '+0987654321', contactPerson: 'Wang Wei', country: 'China', isActive: true
  });

  const category = await db.ProductCategory.create({
    id: uuidv4(), name: 'Default Category'
  });

  const product = await db.Product.create({
    id: uuidv4(), name: 'Test Ceramic Tile 60x60', sku: `TEST-SKU-${Date.now()}`,
    description: 'Test product', unit: 'sqm', basePrice: 25.00, isActive: true,
    categoryId: category.id, factoryId: factory.id
  });

  return { admin, customer, factory, product, authToken };
};

const cleanup = async () => {
  if (dbInstance) { try { await dbInstance.sequelize.close(); } catch(e) {} }
  if (serverInstance) { try { await new Promise(r => serverInstance.close(r)); } catch(e) {} }
  isReady = false; appInstance = null; serverInstance = null; dbInstance = null;
};

module.exports = { getApp, getDb, getRequest, seedTestData, cleanup };
