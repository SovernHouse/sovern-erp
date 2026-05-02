// Sentry instrumentation MUST be the first require in this file. Loading order
// is critical so the SDK can auto-instrument Express, HTTP, and other modules
// before they are loaded. Do not move this line.
const Sentry = require('./instrument');

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const hpp = require('hpp');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
require('dotenv').config();

const db = require('./models');
const { errorHandler } = require('./middleware/errorHandler');
const { authLimiter, generalLimiter } = require('./middleware/rateLimiter');
const { requestId, sanitizeInput, securityHeaders } = require('./middleware/security');
const { requestLogging } = require('./middleware/requestLogging');
const notificationService = require('./services/notificationService');
const apmMiddleware = require('./middleware/apmMiddleware');
const alertService = require('./services/alertService');
const { socketAuthMiddleware, handleSocketDisconnect } = require('./services/socketAuthMiddleware');
const currencyService = require('./services/currencyService');
const ModuleLoader = require('./modules/moduleLoader');
const ConfigManager = require('./modules/configManager');
const createModuleRoutes = require('./modules/moduleRoutes');

const app = express();
const server = http.createServer(app);

const socketCorsOrigins = process.env.SOCKET_IO_CORS_ORIGIN
  ? process.env.SOCKET_IO_CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

const io = socketIO(server, {
  cors: {
    origin: socketCorsOrigins,
    methods: ['GET', 'POST']
  }
});

notificationService.setIO(io);

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
}));

// Configure CORS origins from environment variable or use development defaults
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

app.use(hpp());
app.use(require('cookie-parser')());
app.use(morgan('dev'));
app.use(requestId);
app.use(requestLogging);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(apmMiddleware);
app.use(sanitizeInput);
app.use(securityHeaders);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Public webhook routes (no auth — API-key authenticated only) ─────────────
// Mount BEFORE the generalLimiter block so they get their own rate handling.
const webhookRfqRoutes = require('./routes/webhookRfqRoutes');
app.use('/api/webhook', webhookRfqRoutes);

// Per-route body size limits
app.use('/api/auth', express.json({ limit: '1mb' }), express.urlencoded({ limit: '1mb', extended: true }), authLimiter);
app.use('/api/documents', express.json({ limit: '10mb' }), express.urlencoded({ limit: '10mb', extended: true }));
app.use('/api/exports', express.json({ limit: '10mb' }), express.urlencoded({ limit: '10mb', extended: true }));
app.use('/api/pdf', express.json({ limit: '10mb' }), express.urlencoded({ limit: '10mb', extended: true }));
app.use('/api/', generalLimiter);
// Add request timeout middleware to prevent hanging requests
const { requestTimeoutMiddleware } = require("./middleware/requestTimeout");
app.use("/api/", requestTimeoutMiddleware);

const authRoutes = require('./routes/authRoutes');
const ssoRoutes = require('./routes/ssoRoutes');
const customerRoutes = require('./routes/customerRoutes');
const factoryRoutes = require('./routes/factoryRoutes');
const productRoutes = require('./routes/productRoutes');
const inquiryRoutes = require('./routes/inquiryRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const proformaInvoiceRoutes = require('./routes/proformaInvoiceRoutes');
const salesOrderRoutes = require('./routes/salesOrderRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const packingListRoutes = require('./routes/packingListRoutes');
const shippingDocumentRoutes = require('./routes/shippingDocumentRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const inspectionRoutes = require('./routes/inspectionRoutes');
const claimRoutes = require('./routes/claimRoutes');
const grnRoutes = require('./routes/grnRoutes');
const creditRoutes = require('./routes/creditRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const documentRoutes = require('./routes/documentRoutes');
const auditRoutes = require('./routes/auditRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const backupRoutes = require('./routes/backupRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const userRoutes = require('./routes/userRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const factoryPortalRoutes = require('./routes/factoryPortalRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const exportRoutes = require('./routes/exportRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const personalizationRoutes = require('./routes/personalizationRoutes');
const letterOfCreditRoutes = require('./routes/letterOfCreditRoutes');
const landedCostRoutes = require('./routes/landedCostRoutes');
const sampleRoutes = require('./routes/sampleRoutes');
const productSpecsRoutes = require('./routes/productSpecsRoutes');
const containerLoadingRoutes = require('./routes/containerLoadingRoutes');
const batchTrackingRoutes = require('./routes/batchTrackingRoutes');
const addressBookRoutes = require('./routes/addressBookRoutes');
const cashFlowRoutes = require('./routes/cashFlowRoutes');
const sustainabilityRoutes = require('./routes/sustainabilityRoutes');
const emailRoutes = require('./routes/emailRoutes');
const bankIntegrationRoutes = require('./routes/bankIntegrationRoutes');
const crmRoutes = require('./routes/crm');
const approvalRoutes = require('./routes/approvalRoutes');
const triageRoutes = require('./routes/triageRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/auth/sso', ssoRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/factories', factoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/proforma-invoices', proformaInvoiceRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/packing-lists', packingListRoutes);
app.use('/api/shipping-documents', shippingDocumentRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/grns', grnRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/currencies', currencyRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/factory', factoryPortalRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/personalization', personalizationRoutes);
app.use('/api/address-book', addressBookRoutes);
app.use('/api/cash-flow', cashFlowRoutes);
app.use('/api/sustainability', sustainabilityRoutes);
app.use('/api/letters-of-credit', letterOfCreditRoutes);
app.use('/api/landed-costs', landedCostRoutes);
app.use('/api/samples', sampleRoutes);
app.use('/api/product-specs', productSpecsRoutes);
app.use('/api/container-loading', containerLoadingRoutes);
app.use('/api/batches', batchTrackingRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/bank', bankIntegrationRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/triage', triageRoutes);

// Chatter (polymorphic message thread)
const chatterRoutes = require('./routes/chatterRoutes');
app.use('/api/chatter', chatterRoutes);

// Internal Approvals (manager sign-off)
const internalApprovalRoutes = require('./routes/internalApprovalRoutes');
app.use('/api/internal-approvals', internalApprovalRoutes);

// Compliance & Regulatory routes
const complianceRoutes = require('./modules/compliance/complianceRoutes');
app.use('/api/compliance', complianceRoutes);

// Warehouse Management routes
const warehouseRoutes = require('./modules/warehouse/warehouseRoutes');
app.use('/api/warehouse', warehouseRoutes);

// Initialize Module System
const moduleLoader = new ModuleLoader();
const configManager = new ConfigManager();

// Store for later use during startup
let moduleRegistry = null;
let moduleFeatureFlags = null;

// Health Check Routes
const healthRoutes = require('./routes/healthRoutes');
app.use('/api/health', healthRoutes);

// Swagger API Documentation — only in non-production to avoid the memory overhead
// of the full Swagger UI bundle running 24/7 on the live server.
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      persistAuthorization: true
    }
  }));
} else {
  app.get('/api-docs', (req, res) => {
    res.status(200).send('API documentation is disabled in production. Set NODE_ENV=development to enable.');
  });
}

// Portal switcher: serve built frontend portals from dist
// Access via: http://localhost:5000/?portal=factory or ?portal=admin or ?portal=customer
// Default: factory portal
const portalDistPaths = {
  factory: path.join(__dirname, '..', 'frontend', 'factory-portal', 'dist'),
  admin: path.join(__dirname, '..', 'frontend', 'admin-portal', 'dist'),
  customer: path.join(__dirname, '..', 'frontend', 'customer-portal', 'dist'),
};

// Portal selection page
app.get('/portal-select', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Trading ERP - Portal Selection</title>
  <style>body{font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f1f5f9}
  .container{text-align:center;max-width:600px}.cards{display:flex;gap:20px;justify-content:center;margin-top:30px}
  .card{background:white;border-radius:12px;padding:30px;width:180px;box-shadow:0 4px 6px rgba(0,0,0,.1);cursor:pointer;transition:transform .2s,box-shadow .2s;text-decoration:none;color:#1e293b}
  .card:hover{transform:translateY(-4px);box-shadow:0 8px 20px rgba(0,0,0,.15)}
  .card h3{margin:10px 0 5px}.card p{color:#64748b;font-size:14px;margin:0}
  h1{color:#1e293b;font-size:28px}h2{color:#64748b;font-weight:normal;font-size:16px}</style></head>
  <body><div class="container"><h1>Trading ERP</h1><h2>Select a portal to continue</h2>
  <div class="cards">
  <a class="card" href="/switch-portal?p=admin"><h3>Admin Portal</h3><p>Full ERP management</p></a>
  <a class="card" href="/switch-portal?p=factory"><h3>Factory Portal</h3><p>Production & orders</p></a>
  <a class="card" href="/switch-portal?p=customer"><h3>Customer Portal</h3><p>Orders & tracking</p></a>
  </div></div></body></html>`);
});

// Portal switcher endpoint
app.get('/switch-portal', (req, res) => {
  const portal = req.query.p || 'factory';
  res.cookie('active_portal', portal, { maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/');
});

// Determine active portal from cookie or query
function getActivePortal(req) {
  if (req.query.portal) return req.query.portal;
  if (req.cookies && req.cookies.active_portal) return req.cookies.active_portal;
  return 'factory';
}

// Serve static assets for all portals (check each dist directory)
app.use('/assets', (req, res, next) => {
  const portal = getActivePortal(req);
  const distPath = portalDistPaths[portal] || portalDistPaths.factory;
  express.static(path.join(distPath, 'assets'))(req, res, next);
});

// SPA fallback - serve the active portal's index.html
app.use((req, res, next) => {
  // Skip API routes and known non-page routes
  if (req.path.startsWith('/api') || req.path.startsWith('/api-docs') || req.path.startsWith('/uploads')) {
    return next();
  }
  const portal = getActivePortal(req);
  const distPath = portalDistPaths[portal] || portalDistPaths.factory;
  const indexPath = path.join(distPath, 'index.html');
  // Try to serve static file first, fall back to index.html
  const staticFile = path.join(distPath, req.path);
  res.sendFile(staticFile, (err) => {
    if (err) {
      res.sendFile(indexPath, (err2) => {
        if (err2) next();
      });
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Sentry's Express error handler must be registered BEFORE the app's own
// errorHandler. It captures uncaught errors and forwards them to Sentry,
// then passes the error along to the app's errorHandler for the actual
// HTTP response. If SENTRY_DSN is unset (e.g. local dev), this is a no-op.
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

// Socket.IO middleware for authentication
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} (User: ${socket.userId})`);

  // Legacy support for manual join-user events (if needed)
  socket.on('join-user', (userId) => {
    if (socket.userId === userId) {
      socket.join(`user-${userId}`);
      console.log(`User ${userId} manually joined socket`);
    }
  });

  socket.on('leave-user', (userId) => {
    if (socket.userId === userId) {
      socket.leave(`user-${userId}`);
      console.log(`User ${userId} manually left socket`);
    }
  });

  socket.on('disconnect', () => {
    handleSocketDisconnect(socket);
  });
});

const PORT = process.env.PORT || 5000;
const { optimizeDatabase } = require('./services/connectionPool');

/**
 * Auto-migrate: add missing columns to existing tables before sync().
 * SQLite sync() without alter:true only creates new tables but fails on new columns
 * or duplicate indexes. This function bridges the gap safely.
 */
async function autoMigrateSchema() {
  const dialect = db.sequelize.getDialect();
  if (dialect !== 'sqlite') return; // PostgreSQL handles alter:true fine

  const qi = db.sequelize.getQueryInterface();
  const [tables] = await db.sequelize.query("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.map(t => t.name);
  let fixCount = 0;

  const modelNames = Object.keys(db).filter(k => db[k] && db[k].rawAttributes);
  for (const modelName of modelNames) {
    const model = db[modelName];
    const tableName = model.getTableName();
    if (typeof tableName !== 'string' || tableNames.indexOf(tableName) === -1) continue;

    let desc;
    try { desc = await qi.describeTable(tableName); } catch(e) { continue; }
    const existingCols = Object.keys(desc);

    for (const [attrName, attrDef] of Object.entries(model.rawAttributes)) {
      const colName = attrDef.field || attrName;
      if (existingCols.indexOf(colName) !== -1) continue;

      let sqlType = 'TEXT';
      const dtKey = attrDef.type && attrDef.type.key ? attrDef.type.key : '';
      if (dtKey === 'INTEGER' || dtKey === 'BIGINT') sqlType = 'INTEGER';
      else if (dtKey === 'BOOLEAN') sqlType = 'BOOLEAN DEFAULT 0';
      else if (dtKey === 'DECIMAL' || dtKey === 'FLOAT' || dtKey === 'DOUBLE') sqlType = 'REAL';
      else if (dtKey === 'DATE' || dtKey === 'DATEONLY') sqlType = 'DATETIME';

      try {
        await db.sequelize.query('ALTER TABLE "' + tableName + '" ADD COLUMN "' + colName + '" ' + sqlType);
        fixCount++;
      } catch(e) {
        if (e.message.indexOf('duplicate column') === -1) {
          console.warn('  Column add warning:', tableName + '.' + colName, e.message.substring(0, 60));
        }
      }
    }
  }

  // Drop orphan indexes that would cause sync to fail
  const [indexes] = await db.sequelize.query("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL");
  for (const idx of indexes) {
    if (idx.name && idx.name.indexOf('product_specification_product_id') !== -1) {
      try { await db.sequelize.query('DROP INDEX IF EXISTS "' + idx.name + '"'); } catch(e) {}
    }
  }

  if (fixCount > 0) console.log('[Schema] Auto-migrated ' + fixCount + ' missing columns');
}

// In test mode, skip the DB startup chain entirely.
// setup.js (__tests__/setup.js) owns DB initialization: it calls
// sequelize.sync({ force: true }) directly and wraps the Express app with
// supertest — no port binding needed. Running authenticate/sync/listen here
// during tests causes port collisions across Jest workers and races against
// setup.js's own sync call on the shared in-memory SQLite instance.
if (process.env.NODE_ENV !== 'test') {
db.sequelize.authenticate()
  .then(() => {
    console.log('Database connected successfully');
    return autoMigrateSchema();
  })
  .then(() => {
    // IMPORTANT: Do NOT use sync({ alter: true }) with SQLite - it recreates tables and wipes data
    return db.sequelize.sync();
  })
  .then(() => optimizeDatabase(db.sequelize))
  .then(async () => {
    // Load modules after database is ready
    try {
      await moduleLoader.loadAll(app, db.sequelize, db);
      moduleRegistry = moduleLoader.getRegistry();
      moduleFeatureFlags = moduleLoader.getFeatureFlags();

      // Register module management API routes
      const moduleRoutes = createModuleRoutes(moduleRegistry, moduleFeatureFlags, configManager);
      app.use('/api/modules', moduleRoutes);

      console.log('Module system initialized');
    } catch (error) {
      console.error('Failed to initialize module system:', error.message);
    }
  })
  .then(async () => {
    // Check if database has users - if not, warn to run seed
    const userCount = await db.User.count();
    if (userCount === 0) {
      console.log('');
      console.log('========================================');
      console.log('  WARNING: No users found in database!');
      console.log('  Run: cd backend && node seeds/seed.js');
      console.log('========================================');
      console.log('');
    } else {
      console.log(`Database ready: ${userCount} users found`);
    }

    // Auto-backup on startup if enabled
    if (process.env.ENABLE_AUTO_BACKUP === 'true') {
      try {
        const backupService = require('./services/backupService');
        console.log('Creating startup backup...');
        const backup = await backupService.createBackup();
        console.log(`Backup created: ${backup.filename} (${backup.size} bytes)`);
      } catch (error) {
        console.error('Failed to create startup backup:', error.message);
      }
    }

    // Initialize backup scheduler if enabled
    if (process.env.ENABLE_SCHEDULED_BACKUP === 'true' || process.env.NODE_ENV === 'production') {
      try {
        const backupService = require('./services/backupService');
        const schedulerStatus = backupService.startBackupScheduler();
        if (schedulerStatus.enabled) {
          console.log('Backup scheduler initialized:', schedulerStatus);
        }
      } catch (error) {
        console.error('Failed to initialize backup scheduler:', error.message);
      }
    }

    // Initialize exchange rate scheduler if enabled
    if (process.env.ENABLE_EXCHANGE_RATE_SCHEDULER !== 'false') {
      try {
        currencyService.startScheduledRateUpdate();
        console.log('Exchange rate scheduler initialized');
      } catch (error) {
        console.error('Failed to initialize exchange rate scheduler:', error.message);
      }
    }

    // Initialize business automation scheduler (node-cron)
    // Jobs: overdue activities, follow-up reminders, invoice overdue transitions, production alerts
    if (process.env.DISABLE_SCHEDULER !== 'true') {
      try {
        const schedulerService = require('./services/schedulerService');
        schedulerService.startScheduler();
      } catch (error) {
        // Graceful degradation — the server still starts if node-cron isn't installed yet
        if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('node-cron')) {
          console.warn('[SCHEDULER] node-cron not installed. Run: npm install (in backend directory)');
        } else {
          console.error('Failed to initialize sc