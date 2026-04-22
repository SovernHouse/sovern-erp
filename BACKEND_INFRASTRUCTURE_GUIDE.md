# Backend Infrastructure Implementation Guide

## Overview

This document covers all backend infrastructure components implemented for the Trading ERP system. The implementation includes database migrations, environment configuration, SSL/TLS setup, and automated backup systems.

**Total Files Created: 10**
**All files pass syntax validation**

---

## Task 1: PostgreSQL Migration System

### Files Created

#### 1.1 `backend/migrations/migrate.js`
Migration runner that manages database schema changes.

**Features:**
- Runs pending migrations (`--up` flag)
- Rolls back migrations (`--down` flag)
- Lists migration status (`--list` flag)
- Tracks migrations in `schema_migrations` table
- Supports both SQLite and PostgreSQL
- Transactional safety for failed migrations

**Usage:**
```bash
# Run pending migrations
node backend/migrations/migrate.js --up

# Rollback last batch
node backend/migrations/migrate.js --down

# List status
node backend/migrations/migrate.js --list
```

#### 1.2 `backend/migrations/001_initial_schema.js`
Creates all database tables from model definitions.

**Tables Created (50+ tables):**
- **User Management**: User, SSOAccount, NotificationPreference
- **Customers & Factories**: Customer, Factory, CustomerAddress
- **Products**: Product, ProductCategory, ProductPrice, ProductSpecification, ProductBatch, BatchAllocation
- **Orders**: SalesOrder, SalesOrderItem, PurchaseOrder, PurchaseOrderItem
- **Financial**: Invoice, InvoiceItem, Payment, ProformaInvoice, ProformaInvoiceItem
- **Logistics**: Shipment, ShipmentTracking, PackingList, PackingListItem, ShippingDocument
- **Quality**: Inspection, InspectionItem, InspectionReport, Claim
- **Compliance**: ComplianceRecord, CertificateOfOrigin, HarmonizedCode
- **Inventory**: InventoryItem, InventoryTransaction, GoodsReceivedNote, WarehouseLocation, WarehouseTransaction, StockCount
- **Trade Finance**: LetterOfCredit, LetterOfCreditDocument, LandedCostTemplate, LandedCostCalculation
- **Samples**: SampleRequest, SampleShipment, SampleFeedback
- **System**: Document, DocumentVersion, AuditLog, ExchangeRate, Webhook, WebhookDelivery
- **Personalization**: DashboardLayout, CommissionRule, CommissionTracking, FilterPreset
- **Container Management**: Container, ContainerConfiguration
- **Sustainability**: SustainabilityRecord

**Indexes & Constraints:**
- Primary keys: UUID v4 for all tables
- Foreign keys: Proper relationships with cascade deletes
- Indexes: On frequently searched columns (email, status, dates)
- ENUM types: For status fields
- JSON fields: For flexible data (preferences, specs, dimensions)

#### 1.3 `backend/migrations/002_seed_data.js`
Populates database with demo data for development/testing.

**Demo Data Included:**
- 1 Admin User: `admin@erp.com` / `Admin123!`
- 3 Customers: Global Traders Inc, European Wholesale Ltd, Asia Pacific Imports
- 2 Factories: Shanghai Manufacturing Co, Vietnam Textiles Factory
- 5 Product Categories: Textiles, Electronics, Home & Garden, Furniture, Sports & Outdoors
- 10 Products: T-Shirt, Jeans, LED Bulb, USB Cable, Ceramic Vase, Chair, Yoga Mat, Spoon, Pillow, Speaker
- Product Pricing: 10 price points with different quantities and lead times
- Exchange Rates: USD, EUR, GBP, CNY, AED, SGD, VND

### Integration Notes

**Add to server.js startup:**
```javascript
const { validateEnvironment } = require('./config/validateEnv');
const { initMigrationsTable } = require('./migrations/migrate');

// On startup:
validateEnvironment();
await initMigrationsTable();
```

---

## Task 2: Environment Variable Documentation

### Files Created & Modified

#### 2.1 `.env.example` (Updated)
Comprehensive environment variable reference with:
- **Server Configuration**: PORT, NODE_ENV, API_URL
- **Database**: DB_TYPE (sqlite/postgresql), connection strings, pool settings
- **Authentication**: JWT_SECRET, JWT_REFRESH_SECRET (REQUIRED)
- **Email**: SMTP configuration (RECOMMENDED)
- **Redis**: Cache and session store (RECOMMENDED)
- **Storage**: Local or S3 file storage
- **SSL/TLS**: Certificate paths
- **Backup**: Automation and retention settings
- **Features**: Module and feature flags
- **Security**: CORS, rate limiting, session settings

#### 2.2 `backend/config/validateEnv.js` (New)
Validates environment variables at startup.

**Features:**
- Checks required variables (JWT_SECRET, JWT_REFRESH_SECRET)
- Warns about missing recommended vars (SMTP, Redis, S3)
- Logs configuration summary on startup
- Helper functions to check modules/features at runtime

**Usage in server.js:**
```javascript
const { validateEnvironment } = require('./config/validateEnv');

// Call on startup (before other initialization)
validateEnvironment();
```

**Helper Functions:**
```javascript
const { isModuleEnabled, isFeatureEnabled, getConfigValue } = require('./config/validateEnv');

// Check if modules are enabled
if (isModuleEnabled('compliance')) { /* ... */ }

// Check if features are enabled
if (isFeatureEnabled('multi_currency')) { /* ... */ }

// Get config with fallback
const pageSize = getConfigValue('DEFAULT_PAGE_SIZE', 20);
```

---

## Task 3: SSL/TLS Configuration

### Files Created

#### 3.1 `backend/config/ssl.js`
Manages HTTPS setup and security headers.

**Features:**
- Load certificates from files or environment variables
- Create HTTPS server
- Add security headers (HSTS, X-Frame-Options, etc.)
- Enforce HTTPS redirect in production
- Support for self-signed certs (development)
- SSL status information

**Usage in server.js:**
```javascript
const { createHTTPSServer, enforceHTTPS, addHSTSHeader, isSSLEnabled } = require('./config/ssl');

// Create HTTPS server
if (isSSLEnabled()) {
  const httpsServer = createHTTPSServer(app);
  httpsServer.listen(PORT);
} else {
  app.listen(PORT);
}

// Add middleware
app.use(enforceHTTPS);
app.use(addHSTSHeader);
```

**Environment Variables:**
```
SSL_CERT_PATH=/path/to/cert.crt
SSL_KEY_PATH=/path/to/key.key
SSL_CA_PATH=/path/to/ca.crt (optional)
```

#### 3.2 `docker/nginx.prod.conf` (New)
Production Nginx configuration with SSL termination.

**Features:**
- HTTP → HTTPS redirect
- TLS 1.2 minimum (1.3 preferred)
- Strong cipher suites
- OCSP stapling
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting (auth: 5/m, api: 10/s)
- Gzip compression
- WebSocket support
- Health check endpoint
- Static file caching

**Usage in Docker:**
```dockerfile
COPY docker/nginx.prod.conf /etc/nginx/conf.d/default.conf
```

#### 3.3 `scripts/generate-ssl-cert.sh` (New)
Bash script to generate self-signed certificates for development.

**Features:**
- Generates 2048-bit RSA key
- Valid for configurable days (default: 365)
- Creates organized cert structure
- Prints certificate details
- Provides trust instructions per OS
- Asks for confirmation before overwriting

**Usage:**
```bash
# Generate for 365 days
./scripts/generate-ssl-cert.sh

# Generate for 1095 days (3 years)
./scripts/generate-ssl-cert.sh 1095

# Custom output directory
./scripts/generate-ssl-cert.sh 365 ./backend/certs
```

**Output:**
```
./backend/certs/server.crt  (certificate)
./backend/certs/server.key  (private key)
```

---

## Task 4: Database Backup Automation

### Files Created

#### 4.1 `backend/services/backupAutomation.js` (New)
Enhanced backup system extending existing backupService.

**Features:**
- Create backups with metadata tracking
- Backup verification (gzip integrity, checksum)
- Backup rotation (daily: 7, weekly: 4, monthly: 12)
- Restore with safety backups
- Rollback capability
- S3 upload support
- Backup manifest tracking
- Statistics and reporting
- Support for both SQLite and PostgreSQL

**Main Functions:**

```javascript
const backupAutomation = require('./services/backupAutomation');

// Create backup with metadata and verification
await backupAutomation.createBackupWithMetadata();

// Apply retention policy and cleanup old backups
await backupAutomation.rotateBackups();

// Restore from backup with safety backup
await backupAutomation.restoreBackupWithRollback('backup-2026-03-17_14-30-00.sql.gz');

// Upload backup to S3
await backupAutomation.uploadBackupToS3('backup-2026-03-17_14-30-00.sql.gz');

// Get backup statistics
const stats = backupAutomation.getBackupStatistics();
// Returns: { total, totalSize, oldest, newest, verified }

// Verify backup integrity
const result = await backupAutomation.verifyBackupIntegrity('backup-2026-03-17_14-30-00.sql.gz');
// Returns: { valid, size, reason }
```

**Backup Metadata:**
```json
{
  "backup-2026-03-17_14-30-00.sql.gz": {
    "filename": "backup-2026-03-17_14-30-00.sql.gz",
    "timestamp": "2026-03-17T14:30:00Z",
    "size": 1048576,
    "checksum": "abc123def456...",
    "databaseType": "sqlite",
    "status": "verified",
    "compressed": true,
    "type": "daily"
  }
}
```

#### 4.2 `scripts/backup-restore.sh` (New)
CLI tool for backup operations.

**Commands:**
```bash
# Create backup
./scripts/backup-restore.sh backup

# Restore from backup
./scripts/backup-restore.sh restore backup-2026-03-17_14-30-00.sql.gz

# List backups
./scripts/backup-restore.sh list

# Verify backup integrity
./scripts/backup-restore.sh verify backup-2026-03-17_14-30-00.sql.gz

# Rotate/cleanup old backups
./scripts/backup-restore.sh rotate

# Show statistics
./scripts/backup-restore.sh stats

# Show help
./scripts/backup-restore.sh help
```

**Features:**
- Automatic database type detection (SQLite/PostgreSQL)
- Compression with gzip
- Safety backups before restore
- Backup verification
- Detailed status output
- Statistics reporting
- Works with environment variables

---

## Configuration Flow

### Startup Sequence

1. **Load .env file** (via dotenv)
2. **Validate environment** (validateEnv.js)
   - Check required variables
   - Warn about missing recommended vars
   - Log configuration summary
3. **Connect to database** (database.js)
   - Detect SQLite vs PostgreSQL
   - Configure connection pool
4. **Initialize migrations** (migrate.js)
   - Create schema_migrations table
   - List pending migrations
5. **Run migrations** (--up flag)
   - Execute initial schema
   - Seed demo data
6. **Setup HTTPS** (ssl.js)
   - Load certificates
   - Create HTTPS server
7. **Start application**

### Database Configuration

**SQLite (Development - Default):**
```
DB_TYPE=sqlite
SQLITE_PATH=./database.sqlite
```

**PostgreSQL (Production):**
```
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trading_erp
DB_USER=postgres
DB_PASSWORD=***
DB_POOL_MIN=2
DB_POOL_MAX=10
```

OR use single URL:
```
DATABASE_URL=postgresql://user:pass@host:5432/db
```

---

## Security Considerations

### Required Actions Before Production

1. **Generate Strong Secrets:**
   ```bash
   # Generate 32-char random secret
   openssl rand -base64 24
   ```
   - Set JWT_SECRET
   - Set JWT_REFRESH_SECRET

2. **Configure SSL/TLS:**
   ```bash
   # Generate self-signed or obtain from Let's Encrypt
   ./scripts/generate-ssl-cert.sh 365

   # Or use Let's Encrypt with certbot
   certbot certonly --standalone -d example.com
   ```

3. **Setup Email (SMTP):**
   - Configure SMTP_HOST, SMTP_PORT
   - Set SMTP_USER and SMTP_PASSWORD
   - Verify from address

4. **Database Security:**
   - Change default DB_PASSWORD
   - Use strong DB_USER credentials
   - Enable DB_SSL in production

5. **Nginx/Reverse Proxy:**
   - Use provided nginx.prod.conf
   - Configure domain-specific certificates
   - Enable HSTS header

### Security Headers (Automatic)

All added by ssl.js middleware:
- `Strict-Transport-Security`: Forces HTTPS
- `X-Content-Type-Options`: Prevents MIME sniffing
- `X-Frame-Options`: Prevents clickjacking
- `X-XSS-Protection`: Browser XSS protection
- `Referrer-Policy`: Controls referrer info
- `Permissions-Policy`: Disables unnecessary APIs

---

## Monitoring & Operations

### Check Migration Status
```bash
cd backend
node migrations/migrate.js --list
```

### Create Manual Backup
```bash
./scripts/backup-restore.sh backup
```

### List Backups
```bash
./scripts/backup-restore.sh list
```

### Restore from Backup
```bash
./scripts/backup-restore.sh restore backup-filename.sql.gz
```

### Check Backup Stats
```bash
./scripts/backup-restore.sh stats
```

### Validate Environment
```bash
# Called automatically on startup, but can test manually
node backend/config/validateEnv.js
```

---

## Testing

### Test Migration System
```bash
# Initialize migrations table
node backend/migrations/migrate.js --list

# Run migrations
node backend/migrations/migrate.js --up

# Verify database created
sqlite3 backend/database.sqlite ".tables"

# List migration status
node backend/migrations/migrate.js --list

# Rollback (optional)
node backend/migrations/migrate.js --down
```

### Test SSL Certificate Generation
```bash
./scripts/generate-ssl-cert.sh 365 ./test-certs

# Verify certificate
openssl x509 -in ./test-certs/server.crt -text -noout | head -20
```

### Test Backup System
```bash
# Create backup
./scripts/backup-restore.sh backup

# Verify
./scripts/backup-restore.sh verify backup-*.sql.gz

# Check stats
./scripts/backup-restore.sh stats
```

---

## File Reference

| File | Purpose | Type |
|------|---------|------|
| `backend/migrations/migrate.js` | Migration runner | JavaScript |
| `backend/migrations/001_initial_schema.js` | Schema creation | JavaScript Migration |
| `backend/migrations/002_seed_data.js` | Demo data | JavaScript Migration |
| `backend/config/validateEnv.js` | Environment validation | JavaScript |
| `backend/config/ssl.js` | SSL/TLS management | JavaScript |
| `backend/services/backupAutomation.js` | Backup system | JavaScript Service |
| `docker/nginx.prod.conf` | Production Nginx config | Nginx Config |
| `scripts/generate-ssl-cert.sh` | Certificate generation | Bash Script |
| `scripts/backup-restore.sh` | Backup CLI | Bash Script |
| `.env.example` | Environment template | Config Template |

---

## Troubleshooting

### Migration Fails
1. Check database connection: `node backend/config/database.js`
2. Verify env variables: `node backend/config/validateEnv.js`
3. Check migrations table exists
4. Review error in schema definition

### SSL Certificate Issues
1. Verify paths exist: `ls -la backend/certs/`
2. Check permissions: `chmod 600 backend/certs/server.key`
3. Test certificate: `openssl x509 -in backend/certs/server.crt -text -noout`

### Backup Fails
1. Check write permissions: `ls -la backend/backups/`
2. Verify database accessibility
3. Check disk space: `df -h`
4. For PostgreSQL: verify `pg_dump` is installed

### Email Not Sending
1. Check SMTP configuration: `grep SMTP .env`
2. Test connection: `node -e "require('nodemailer').createTransport({...})"`
3. Verify ENABLE_EMAIL=true

---

## Future Enhancements

1. **Automated Backup Scheduling**: Use cron or node-cron for scheduled backups
2. **Backup Encryption**: Add encryption for sensitive backups
3. **Distributed Backups**: Multi-region S3 backup strategy
4. **Point-in-Time Recovery**: Transaction log backups for PostgreSQL
5. **Backup Monitoring**: Prometheus metrics for backup status
6. **Database Snapshots**: Automated snapshots via cloud providers
7. **Zero-Downtime Migrations**: Blue-green deployment support

---

## Support & Documentation

- Migration Patterns: See model definitions in `backend/models/`
- Database Config: See `backend/config/database.js`
- Backup Config: See `backend/config/backupConfig.js`
- Environment Guide: See `.env.example`

---

**Last Updated**: 2026-03-17
**Status**: All components tested and verified
