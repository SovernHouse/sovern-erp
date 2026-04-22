#!/usr/bin/env node

/**
 * Migration Guide and Helper Script for SQLite to PostgreSQL
 *
 * This script provides:
 * 1. Pre-migration checks and validation
 * 2. Database URL validation
 * 3. Migration step instructions
 * 4. Post-migration verification
 *
 * Usage:
 *   node scripts/migrate-to-postgres.js [check|setup|verify|all]
 *
 * Commands:
 *   check   - Validate PostgreSQL connection and configuration
 *   setup   - Print setup instructions
 *   verify  - Verify migration success
 *   all     - Run all checks and print full guide
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkPostgresConnection() {
  log('\n=== Checking PostgreSQL Connection ===', 'cyan');

  const dbUrl = process.env.DATABASE_URL ||
    `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

  if (!dbUrl || dbUrl.includes('undefined')) {
    log('ERROR: PostgreSQL connection not configured', 'red');
    log('Set one of:', 'yellow');
    log('  - DATABASE_URL environment variable', 'yellow');
    log('  - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT', 'yellow');
    return false;
  }

  try {
    log('Testing connection to PostgreSQL...', 'blue');

    const sequelize = new Sequelize(dbUrl, {
      dialect: 'postgres',
      logging: false,
      ssl: process.env.DB_SSL !== 'false',
      dialectOptions: process.env.DB_SSL !== 'false' ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {},
      pool: { max: 1, min: 0 }
    });

    await sequelize.authenticate();
    log('SUCCESS: Connected to PostgreSQL', 'green');

    // Get database info
    const result = await sequelize.query(`
      SELECT version(), current_database(), current_user
    `);

    const [pgVersion, dbName, user] = result[0][0];
    log(`PostgreSQL Version: ${pgVersion.split(' ')[1]}`, 'blue');
    log(`Database: ${dbName}, User: ${user}`, 'blue');

    await sequelize.close();
    return true;
  } catch (err) {
    log(`ERROR: Connection failed: ${err.message}`, 'red');
    return false;
  }
}

function printSetupGuide() {
  log('\n=== PostgreSQL Migration Setup Guide ===', 'cyan');

  log('\nStep 1: Create PostgreSQL Database', 'blue');
  log('If not already created, create the database:', 'yellow');
  log(`
  sudo -u postgres createdb trading_erp
  sudo -u postgres createuser trading_user
  sudo -u postgres psql -c "ALTER USER trading_user WITH PASSWORD 'your_secure_password';"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE trading_erp TO trading_user;"
  `, 'yellow');

  log('\nStep 2: Configure Environment Variables', 'blue');
  log('Add to your .env file:', 'yellow');
  log(`
  DATABASE_URL=postgres://trading_user:password@localhost:5432/trading_erp
  # OR individual variables:
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=trading_erp
  DB_USER=trading_user
  DB_PASSWORD=your_secure_password
  DB_SSL=false  # Set to true if SSL is required
  `, 'yellow');

  log('\nStep 3: Run Database Migrations', 'blue');
  log('Execute all pending migrations:', 'yellow');
  log(`
  npm run migrate
  `, 'yellow');

  log('\nStep 4: Verify Migration', 'blue');
  log('Check that all tables were created:', 'yellow');
  log(`
  node scripts/migrate-to-postgres.js verify
  `, 'yellow');

  log('\nStep 5: Data Migration (if migrating from SQLite)', 'blue');
  log('If you have existing data in SQLite:', 'yellow');
  log(`
  1. Export data from SQLite database.sqlite
  2. Transform data if needed (handle dialect differences)
  3. Import to PostgreSQL

  For large datasets, consider using pg_dump and other tools.
  `, 'yellow');

  log('\nStep 6: Update Application Configuration', 'blue');
  log('The application automatically detects PostgreSQL via:', 'yellow');
  log('  - DATABASE_URL environment variable', 'blue');
  log('  - Individual DB_* variables', 'blue');
  log('  - Dialect helper functions handle SQL differences', 'blue');

  log('\nImportant Notes:', 'yellow');
  log('  - The application supports both SQLite and PostgreSQL simultaneously', 'yellow');
  log('  - Use dialectHelper.js for SQL dialect-specific code', 'yellow');
  log('  - All indexes must use snake_case field names (underscored: true)', 'yellow');
  log('  - Test with NODE_ENV=test to ensure tests pass', 'yellow');
}

async function verifyMigration() {
  log('\n=== Verifying PostgreSQL Migration ===', 'cyan');

  const dbUrl = process.env.DATABASE_URL ||
    `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

  if (!dbUrl || dbUrl.includes('undefined')) {
    log('ERROR: PostgreSQL not configured', 'red');
    return false;
  }

  try {
    const sequelize = new Sequelize(dbUrl, {
      dialect: 'postgres',
      logging: false,
      ssl: process.env.DB_SSL !== 'false',
      dialectOptions: process.env.DB_SSL !== 'false' ? {
        ssl: { require: true, rejectUnauthorized: false }
      } : {},
      pool: { max: 1, min: 0 }
    });

    // Get list of tables
    const [tables] = await sequelize.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    log(`Found ${tables.length} tables:`, 'green');

    const expectedTables = [
      'User', 'Customer', 'Factory', 'ProductCategory', 'Product', 'ProductPrice',
      'Inquiry', 'InquiryItem', 'Quotation', 'QuotationItem',
      'ProformaInvoice', 'ProformaInvoiceItem',
      'SalesOrder', 'SalesOrderItem', 'PurchaseOrder', 'PurchaseOrderItem',
      'PackingList', 'PackingListItem', 'ShippingDocument',
      'Shipment', 'ShipmentTracking',
      'Inspection', 'InspectionItem', 'InspectionReport',
      'Claim', 'Invoice', 'Payment',
      'Notification', 'AuditLog', 'InventoryItem', 'InventoryTransaction',
      'Document', 'Lead', 'Deal', 'Contact', 'Activity', 'Campaign',
      'SSOAccount', 'Webhook', 'WebhookDelivery', 'ExchangeRate'
    ];

    const tableNames = tables.map(t => t.table_name);
    let allTablesPresent = true;

    for (const table of expectedTables) {
      if (tableNames.includes(table)) {
        log(`  ✓ ${table}`, 'green');
      } else {
        log(`  ✗ ${table} (missing)`, 'red');
        allTablesPresent = false;
      }
    }

    if (allTablesPresent) {
      log('\nSUCCESS: All expected tables are present', 'green');
    } else {
      log('\nWARNING: Some tables are missing. Run migrations:', 'yellow');
      log('npm run migrate', 'yellow');
    }

    // Check for SequelizeMeta table (migration tracking)
    const [meta] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'SequelizeMeta'
    `);

    if (meta[0].count > 0) {
      log('\nMigration tracking table (SequelizeMeta) exists', 'green');
    } else {
      log('\nWARNING: SequelizeMeta not found. Migrations may not have been tracked', 'yellow');
    }

    await sequelize.close();
    return allTablesPresent;
  } catch (err) {
    log(`ERROR: Verification failed: ${err.message}`, 'red');
    return false;
  }
}

async function printCompleteGuide() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║   Trading ERP - SQLite to PostgreSQL Migration Guide     ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');

  log('\nThis guide helps you migrate from SQLite to PostgreSQL.', 'blue');
  log('The application supports both dialects automatically.', 'blue');

  printSetupGuide();

  log('\n=== Testing After Migration ===', 'cyan');
  log('Run tests to ensure everything works:', 'yellow');
  log(`
  NODE_ENV=test npm test
  `, 'yellow');

  log('\n=== Key Features ===', 'cyan');
  log('  ✓ Automatic dialect detection via DATABASE_URL or DB_* vars', 'green');
  log('  ✓ Dialect helper functions (likeOp, containsOp, etc.)', 'green');
  log('  ✓ Full support for both SQLite and PostgreSQL', 'green');
  log('  ✓ Zero-downtime migration possible with fallback', 'green');

  log('\n=== Troubleshooting ===', 'cyan');
  log('Connection Issues:', 'yellow');
  log('  - Ensure PostgreSQL is running', 'yellow');
  log('  - Check credentials and network connectivity', 'yellow');
  log('  - Verify DATABASE_URL or DB_* environment variables', 'yellow');

  log('\nMigration Issues:', 'yellow');
  log('  - Check PostgreSQL version (15+ recommended)', 'yellow');
  log('  - Ensure database has proper encoding (UTF8)', 'yellow');
  log('  - Review migration files for compatibility', 'yellow');

  log('\n=== Support ===', 'cyan');
  log('For issues, check:', 'yellow');
  log('  - backend/migrations/ directory for migration files', 'yellow');
  log('  - backend/utils/dialectHelper.js for dialect handling', 'yellow');
  log('  - backend/config/database.js for configuration', 'yellow');

  log('\n');
}

async function main() {
  const command = process.argv[2] || 'all';

  switch (command) {
    case 'check':
      await checkPostgresConnection();
      break;

    case 'setup':
      printSetupGuide();
      break;

    case 'verify':
      await verifyMigration();
      break;

    case 'all':
    default:
      await printCompleteGuide();
      log('Running connection check...', 'cyan');
      const connected = await checkPostgresConnection();
      if (connected) {
        log('\nRunning migration verification...', 'cyan');
        await verifyMigration();
      }
      break;
  }
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`, 'red');
  process.exit(1);
});
