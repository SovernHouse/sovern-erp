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
// Use __dirname so .env is always found relative to server.js regardless of PM2 cwd
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./models');
const { errorHandler } = require('./middleware/errorHandler');
const { authLimiter, generalLimiter } = require('./middleware/rateLimiter');
const { requestId, sanitizeInput, securityHeaders } = require('./middleware/security');
const { requestLogging } = require('./middleware/requestLogging');
const notificationService = require('./services/notificationService');
const chatService = require('./services/chatService');
const apmMiddleware = require('./middleware/apmMiddleware');
const alertService = require('./services/alertService');
const { socketAuthMiddleware, handleSocketDisconnect } = require('./services/socketAuthMiddleware');
const currencyService = require('./services/currencyService');
const ModuleLoader = require('./modules/moduleLoader');
const ConfigManager = require('./modules/configManager');
const createModuleRoutes = require('./modules/moduleRoutes');
const logger = require('./utils/logger.js');

const app = express();

// Production runs behind nginx (1 hop). Express needs to trust the proxy
// so req.ip and req.protocol reflect the real client, and so libraries
// like express-rate-limit don't throw ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

// Sentry's request handler must be the FIRST middleware to attach so it
// can capture context for every incoming request, including transactions
// that fail in subsequent middleware. When SENTRY_DSN is not set this is
// a no-op (see instrument.js fallback shim).
app.use(Sentry.Handlers.requestHandler());

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
chatService.setIO(io);

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
// PERF: morgan and requestLogging both log every request. In production we
// only need requestLogging (Winston, structured, file transport). Keeping
// morgan in dev for human-readable terminal output.
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
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
// Add request timeout middleware to prevent hanging requests.
// AI chat is the one slow endpoint (claude -p subprocess + MCP tool chain
// can take 60-120s). Apply 150s to it, default 30s to everything else.
const { createTimeoutMiddleware } = require("./middleware/requestTimeout");
app.use("/api/ai/chat", createTimeoutMiddleware(150000));
app.use("/api/", (req, res, next) => {
  if (req.path === '/ai/chat' || req.path.startsWith('/ai/chat')) return next();
  return createTimeoutMiddleware(30000)(req, res, next);
});

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
const googleRoutes = require('./routes/googleRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const driveRoutes = require('./routes/driveRoutes');
const aiRoutes = require('./routes/aiRoutes');
const devModeRoutes = require('./routes/devModeRoutes');
const pushTokenRoutes = require('./routes/pushTokenRoutes');
const researchRoutes = require('./routes/researchRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const brandRoutes = require('./routes/brandRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api', brandRoutes); // mounts /api/brands, /api/brands/me, /api/admin/brand-override
app.use('/api', adminRoutes); // Phase 4.7, C-3: mounts /api/admin/drive-setup
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
app.use('/api/google', googleRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dev-mode', devModeRoutes);
app.use('/api/push-tokens', pushTokenRoutes);
app.use('/api/research', researchRoutes);
app.use('/api', expenseRoutes); // mounts /api/expenses, /api/expense-offices, /api/expense-trips, /api/expense-submissions

// Chatter (polymorphic message thread)
const chatterRoutes = require('./routes/chatterRoutes');
app.use('/api/chatter', chatterRoutes);

// Internal Chat (omnichannel inbox — WhatsApp/Telegram/internal)
const chatRoutes = require('./routes/chatRoutes');
app.use('/api/chat', chatRoutes);

// Scheduled Activities (Odoo-style task assignment on any record)
const scheduledActivityRoutes = require('./routes/scheduledActivityRoutes');
app.use('/api/scheduled-activities', scheduledActivityRoutes);

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
// HTTP response. If SENTRY_DSN is unset (e.g. local dev) or the SDK
// failed to load, this is a no-op (see instrument.js fallback shim).
app.use(Sentry.Handlers.errorHandler());

app.use(errorHandler);

// Socket.IO middleware for authentication
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} (User: ${socket.userId})`);

  // Legacy support for manual join-user events (if needed)
  socket.on('join-user', (userId) => {
    if (socket.userId === userId) {
      socket.join(`user-${userId}`);
      logger.info(`User ${userId} manually joined socket`);
    }
  });

  socket.on('leave-user', (userId) => {
    if (socket.userId === userId) {
      socket.leave(`user-${userId}`);
      logger.info(`User ${userId} manually left socket`);
    }
  });

  // Internal chat — join/leave rooms and typing indicators
  chatService.handleChatSocket(socket);

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
          logger.warn('  Column add warning:', tableName + '.' + colName, e.message.substring(0, 60));
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

  if (fixCount > 0) logger.info('[Schema] Auto-migrated ' + fixCount + ' missing columns');
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
    logger.info('Database connected successfully');
    return autoMigrateSchema();
  })
  .then(() => {
    // IMPORTANT: Do NOT use sync({ alter: true }) with SQLite - it recreates tables and wipes data.
    // Plain sync() is also imperfect: when a model declares an explicit
    // `indexes:` block (e.g. ProductSpecification's unique product_id),
    // sync() issues CREATE UNIQUE INDEX every boot and SQLite throws if
    // the index already exists. This is harmless but spams Sentry. Catch
    // and rethrow only for non-"already exists" errors.
    return db.sequelize.sync().catch(err => {
      const msg = (err && err.message) || '';
      const inner = (err && err.parent && err.parent.message) || '';
      if (/already exists/i.test(msg) || /already exists/i.test(inner)) {
        logger.warn('sync(): ignoring benign "already exists" error:', inner || msg);
        return;
      }
      throw err;
    });
  })
  .then(async () => {
    // Additive SQLite column migrations -- safe to run every boot, no-op if column exists.
    // Required because sequelize.sync() only creates missing tables, never adds missing columns.
    const additiveMigrations = [
      'ALTER TABLE TriageItems ADD COLUMN sync_requested_at DATETIME',
      // Product dual-description fields (client-facing vs supplier-facing)
      'ALTER TABLE Products ADD COLUMN sales_description TEXT',
      'ALTER TABLE Products ADD COLUMN purchase_description TEXT',
      // ProductPrice Incoterm fields
      'ALTER TABLE ProductPrices ADD COLUMN exw_price DECIMAL(12,2)',
      "ALTER TABLE ProductPrices ADD COLUMN price_type VARCHAR(10) DEFAULT 'FOB'",
      // ProductSpecification client-visible fields selector
      'ALTER TABLE ProductSpecifications ADD COLUMN client_visible_fields TEXT',
    ];
    for (const sql of additiveMigrations) {
      try {
        await db.sequelize.query(sql);
        logger.info(`Migration applied: ${sql}`);
      } catch (_) {
        // "duplicate column name" -- column already exists, skip silently
      }
    }

    // Belt-and-braces: explicitly sync the small set of recently-added
    // tables that the chain-level sync() above can silently miss
    // (suspected: an index-creation race that catches as "already exists"
    // and aborts the table create on the same iteration). model.sync() is
    // idempotent on existing tables.
    const lateAdditions = ['DevModeRun', 'ExpoPushToken', 'ResearchTask',
      'ReimbursementOffice', 'Trip', 'ExpenseSubmission', 'Expense', 'Brand'];
    for (const modelName of lateAdditions) {
      if (!db[modelName]) continue;
      try {
        await db[modelName].sync();
      } catch (e) {
        const msg = (e && e.message) || '';
        if (!/already exists/i.test(msg)) {
          logger.warn(`[boot] late sync for ${modelName} failed:`, msg);
        }
      }
    }

    // Phase 1 multi-brand: seed SH + FW rows idempotently. Safe re-entry —
    // existing rows are preserved unchanged.
    try {
      const { seedBrandsIfEmpty } = require('./services/seedBrands');
      await seedBrandsIfEmpty(db);
    } catch (e) {
      logger.warn('[boot] brand seed skipped:', e.message);
    }

    // Phase 2: seed FW outreach templates + backfill existing templates to brandCode='SH'.
    try {
      const { seedFWEmailTemplatesIfEmpty } = require('./services/seedEmailTemplates');
      await seedFWEmailTemplatesIfEmpty(db);
    } catch (e) {
      logger.warn('[boot] email template seed skipped:', e.message);
    }

    // Phase 3, C11: seed "FW Sales Commission" rule (5% default; adjustable per-order).
    try {
      const { seedCommissionRulesIfEmpty } = require('./services/seedCommissionRules');
      await seedCommissionRulesIfEmpty(db);
    } catch (e) {
      logger.warn('[boot] commission rule seed skipped:', e.message);
    }

    // Phase 4, C14: seed placeholder catalog products (3 FW, 2 SH). Real
    // product data Alex manages via the /settings/products admin UI.
    try {
      const { seedProductsIfEmpty } = require('./services/seedProducts');
      await seedProductsIfEmpty(db);
    } catch (e) {
      logger.warn('[boot] product seed skipped:', e.message);
    }

    // Phase 4, C15: status enum migration + brandCode / customerId /
    // accrualDate backfill on CommissionTracking, and commissionRate
    // backfill on Brand. Idempotent (sentinel AuditLog rows).
    try {
      const { migrateCommissionsC15 } = require('./services/migrateCommissionsC15');
      await migrateCommissionsC15(db);
    } catch (e) {
      logger.warn('[boot] C15 commission migration skipped:', e.message);
    }

    // Phase 1 multi-brand (Commit 2): backfill brandCode='SH' on every
    // transactional row that's NULL after autoMigrateSchema added the column.
    // Customer.brandRelationships, User.accessibleBrands/defaultBrand are
    // backfilled here too. Super-admin user(s) are upgraded to ['SH','FW'].
    // Warn-and-continue: failures are logged but never crash boot.
    try {
      const { backfillBrandsIfNeeded } = require('./services/migrateBrands');
      await backfillBrandsIfNeeded(db);
    } catch (e) {
      logger.warn('[boot] brand backfill skipped:', e.message);
    }

    // Phase 4, C17: tag every ConnectedGoogleAccount with its brand by
    // matching account.email to Brand.senderEmail. Idempotent via AuditLog
    // sentinel; orphan accounts are warned, not crashed.
    try {
      const { migrateConnectedAccounts } = require('./services/migrateConnectedAccounts');
      await migrateConnectedAccounts(db);
    } catch (e) {
      logger.warn('[boot] C17 connected accounts migration skipped:', e.message);
    }

    // Phase 4, C18: default screeningStatus='pending' on existing Customer
    // + Lead rows so the 4 hard-block entry points see a coherent enum
    // value and the 90d rescreen cron picks them up.
    try {
      const { migrateSanctionsC18 } = require('./services/migrateSanctionsC18');
      await migrateSanctionsC18(db);
    } catch (e) {
      logger.warn('[boot] C18 sanctions backfill skipped:', e.message);
    }

    // Phase 4.5, C24: refresh FW Brand signature (HTML + text) to the
    // Country Manager / FlorWay+HanHua design. Idempotent via AuditLog
    // sentinel; SH untouched.
    try {
      const { migrateBrandSignaturesC24 } = require('./services/migrateBrandSignaturesC24');
      await migrateBrandSignaturesC24(db);
    } catch (e) {
      logger.warn('[boot] C24 FW signature refresh skipped:', e.message);
    }

    // Phase 4.5, C20: archive pre-populated seed Products + paired
    // ProductPrice / ProductSpecification + the empty Quotation /
    // SalesOrder / ProformaInvoice / Invoice / PurchaseOrder /
    // CommissionTracking tables. Rows survive in ArchivedSeed_* mirrors.
    // Idempotent via AuditLog sentinel. Runs BEFORE seedProducts so the
    // catalog can re-seed with the Phase 4 placeholders against an empty
    // table.
    try {
      const { migrateSeedDataC20 } = require('./services/migrateSeedDataC20');
      await migrateSeedDataC20(db);
    } catch (e) {
      logger.warn('[boot] C20 seed-data archival skipped:', e.message);
    }
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

      logger.info('Module system initialized');
    } catch (error) {
      logger.error('Failed to initialize module system:', error.message);
    }
  })
  .then(async () => {
    // Dev-mode boot recovery: any run still in non-terminal status is from
    // a process that died before completion — mark them failed so users
    // aren't left with phantom "running" rows.
    try {
      const { recoverStaleRuns } = require('./services/devModeRunner');
      await recoverStaleRuns();
    } catch (e) {
      logger.warn('[dev-mode] Boot recovery skipped:', e.message);
    }
  })
  .then(async () => {
    // Research-task boot recovery: same pattern as dev-mode. Any
    // queued/running task on boot was orphaned by a process restart.
    try {
      const { recoverStaleResearchTasks } = require('./services/researchRunner');
      await recoverStaleResearchTasks();
    } catch (e) {
      logger.warn('[research] Boot recovery skipped:', e.message);
    }
  })
  .then(async () => {
    // Check if database has users - if not, warn to run seed
    const userCount = await db.User.count();
    if (userCount === 0) {
      logger.info('');
      logger.info('========================================');
      logger.info('  WARNING: No users found in database!');
      logger.info('  Run: cd backend && node seeds/seed.js');
      logger.info('========================================');
      logger.info('');
    } else {
      logger.info(`Database ready: ${userCount} users found`);
    }

    // Auto-backup on startup if enabled
    if (process.env.ENABLE_AUTO_BACKUP === 'true') {
      try {
        const backupService = require('./services/backupService');
        logger.info('Creating startup backup...');
        const backup = await backupService.createBackup();
        logger.info(`Backup created: ${backup.filename} (${backup.size} bytes)`);
      } catch (error) {
        logger.error('Failed to create startup backup:', error.message);
      }
    }

    // Initialize backup scheduler if enabled
    if (process.env.ENABLE_SCHEDULED_BACKUP === 'true' || process.env.NODE_ENV === 'production') {
      try {
        const backupService = require('./services/backupService');
        const schedulerStatus = backupService.startBackupScheduler();
        if (schedulerStatus.enabled) {
          logger.info('Backup scheduler initialized:', schedulerStatus);
        }
      } catch (error) {
        logger.error('Failed to initialize backup scheduler:', error.message);
      }
    }

    // Initialize exchange rate scheduler if enabled
    if (process.env.ENABLE_EXCHANGE_RATE_SCHEDULER !== 'false') {
      try {
        currencyService.startScheduledRateUpdate();
        logger.info('Exchange rate scheduler initialized');
      } catch (error) {
        logger.error('Failed to initialize exchange rate scheduler:', error.message);
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
          logger.warn('[SCHEDULER] node-cron not installed. Run: npm install (in backend directory)');
        } else {
          logger.error('Failed to initialize scheduler:', error.message);
        }
      }
    }

    // Initialize Gmail sync scheduler (every 5 minutes)
    // Only runs when at least one Google account is connected.
    if (process.env.DISABLE_GMAIL_SYNC !== 'true') {
      try {
        const cron = require('node-cron');
        const { runGmailSync } = require('./services/gmailSyncService');
        // Configurable interval (minutes). Default 60 min — was 5 min, lowered
        // because high-frequency polling burns Gmail API quota on idle days
        // and produces little extra value over a UI / AI-driven on-demand
        // "sync now" path (POST /api/triage/sync-requested or the
        // sync_inbox_now MCP tool).
        const intervalMin = Math.max(1, parseInt(process.env.GMAIL_SYNC_INTERVAL_MINUTES || '60', 10));
        const cronExpr = intervalMin >= 60
          ? `0 */${Math.floor(intervalMin / 60)} * * *`  // every N hours at :00
          : `*/${intervalMin} * * * *`;                   // every N minutes
        cron.schedule(cronExpr, () => {
          runGmailSync().catch(err => logger.error('[gmail-sync] Cron error:', err.message));
        });
        logger.info(`[gmail-sync] Gmail sync scheduler initialized (every ${intervalMin} min, cron: ${cronExpr})`);
      } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('googleapis')) {
          logger.warn('[gmail-sync] googleapis not installed. Run: npm install (in backend directory)');
        } else {
          logger.error('[gmail-sync] Failed to initialize Gmail sync:', error.message);
        }
      }
    }

    // Initialize Google Calendar sync scheduler (every 15 minutes)
    if (process.env.DISABLE_CALENDAR_SYNC !== 'true') {
      try {
        const cron = require('node-cron');
        const { runCalendarSync } = require('./services/calendarSyncService');
        cron.schedule('*/15 * * * *', () => {
          runCalendarSync().catch(err => logger.error('[calendar-sync] Cron error:', err.message));
        });
        logger.info('[calendar-sync] Calendar sync scheduler initialized (every 15 min)');
      } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('googleapis')) {
          logger.warn('[calendar-sync] googleapis not installed — skipping Calendar sync');
        } else {
          logger.error('[calendar-sync] Failed to initialize Calendar sync:', error.message);
        }
      }
    }

    server.listen(PORT, () => {
      logger.info(`Trading ERP Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(err => {
    logger.error('Database connection error:', err);
    process.exit(1);
  });
} // end if (NODE_ENV !== 'test')

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

module.exports = { app, server, io };
