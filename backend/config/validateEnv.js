/**
 * Environment Variable Validation
 * Validates required and recommended environment variables on startup
 *
 * Required: JWT_SECRET, JWT_REFRESH_SECRET
 * Recommended: SMTP_*, Redis, S3
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Required environment variables
 * System will not start without these
 */
const REQUIRED_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

/**
 * Recommended environment variables
 * System will log warnings if missing
 */
const RECOMMENDED_VARS = {
  email: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
  redis: ['REDIS_HOST', 'REDIS_PORT'],
  storage: ['S3_BUCKET', 'S3_KEY', 'S3_SECRET'],
  backup: ['BACKUP_DIR', 'BACKUP_RETENTION_DAYS'],
  ssl: ['SSL_CERT_PATH', 'SSL_KEY_PATH']
};

/**
 * Validate required variables
 * Throws error if any required var is missing
 */
function validateRequired() {
  const missing = [];

  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables:\n  - ${missing.join('\n  - ')}\n\nPlease set these in your .env file before starting the application.`;
    throw new Error(message);
  }
}

/**
 * Warn about missing recommended variables
 * Logs warnings but doesn't block startup
 */
function validateRecommended() {
  const warnings = [];

  // Check email configuration
  const emailVars = RECOMMENDED_VARS.email;
  const emailConfigured = emailVars.every(v => process.env[v]);
  if (!emailConfigured) {
    warnings.push(`Email configuration incomplete (${emailVars.filter(v => !process.env[v]).join(', ')}). Email features will be disabled.`);
  }

  // Check Redis configuration
  const redisVars = RECOMMENDED_VARS.redis;
  const redisConfigured = redisVars.every(v => process.env[v]);
  if (!redisConfigured) {
    warnings.push(`Redis not configured (${redisVars.filter(v => !process.env[v]).join(', ')}). Caching will be disabled; use in-memory cache.`);
  }

  // Check S3 configuration
  const storageVars = RECOMMENDED_VARS.storage;
  const storageConfigured = storageVars.every(v => process.env[v]);
  if (!storageConfigured) {
    warnings.push(`S3 storage not configured (${storageVars.filter(v => !process.env[v]).join(', ')}). Files will be stored locally.`);
  }

  // Check backup configuration
  if (!process.env.BACKUP_DIR) {
    warnings.push('BACKUP_DIR not configured. Backups will be stored in ./backups.');
  }

  // Check SSL configuration
  const sslVars = RECOMMENDED_VARS.ssl;
  const sslConfigured = sslVars.every(v => process.env[v]);
  if (process.env.NODE_ENV === 'production' && !sslConfigured) {
    warnings.push(`SSL not configured (${sslVars.filter(v => !process.env[v]).join(', ')}). HTTPS will not be enabled.`);
  }

  // Log all warnings
  if (warnings.length > 0) {
    console.warn('\n[ENVIRONMENT] Configuration Warnings:\n');
    warnings.forEach((msg, i) => {
      console.warn(`  ${i + 1}. ${msg}`);
    });
    console.warn('');
  }

  return warnings;
}

/**
 * Log configured environment
 */
function logEnvironmentSummary() {
  console.log('\n[ENVIRONMENT] Configuration Summary:');
  console.log(`  Node Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Server Port: ${process.env.PORT || 3001}`);

  if (process.env.DB_TYPE === 'postgresql') {
    console.log(`  Database: PostgreSQL (${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME})`);
  } else {
    console.log(`  Database: SQLite (${process.env.SQLITE_PATH || './database.sqlite'})`);
  }

  console.log(`  JWT Expiry: ${process.env.JWT_EXPIRES_IN || '7d'}`);
  console.log(`  Rate Limit: ${process.env.RATE_LIMIT_MAX_REQUESTS || 100} requests per ${(parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000) / 60000).toFixed(0)} minutes`);

  const features = [];
  if (process.env.ENABLE_EMAIL === 'true') features.push('Email');
  if (process.env.ENABLE_AUDIT_LOG === 'true') features.push('Audit Logging');
  if (process.env.FEATURE_MULTI_CURRENCY === 'true') features.push('Multi-Currency');
  if (process.env.ENABLE_AUTO_BACKUP === 'true') features.push('Auto Backup');

  if (features.length > 0) {
    console.log(`  Enabled Features: ${features.join(', ')}`);
  }

  console.log('');
}

/**
 * Main validation function
 * Call this from server.js on startup
 */
function validateEnvironment() {
  try {
    console.log('[ENVIRONMENT] Validating environment variables...');

    // Validate required variables (throws on error)
    validateRequired();
    console.log('[ENVIRONMENT] ✓ All required variables present\n');

    // Warn about recommended variables
    validateRecommended();

    // Log environment summary
    logEnvironmentSummary();

    return true;
  } catch (error) {
    console.error('[ENVIRONMENT] ✗ Configuration Error:');
    console.error(error.message);
    console.error('\nRef: .env.example for all available variables');
    process.exit(1);
  }
}

/**
 * Check if a module is enabled
 * @param {string} moduleName - Module name (e.g., 'compliance', 'warehouse')
 * @returns {boolean}
 */
function isModuleEnabled(moduleName) {
  const key = `MODULE_${moduleName.toUpperCase()}_ENABLED`;
  return process.env[key] !== 'false';
}

/**
 * Check if a feature is enabled
 * @param {string} featureName - Feature name (e.g., 'multi_currency')
 * @returns {boolean}
 */
function isFeatureEnabled(featureName) {
  const key = `FEATURE_${featureName.toUpperCase()}`;
  return process.env[key] !== 'false';
}

/**
 * Get configuration value with fallback
 * @param {string} varName - Variable name
 * @param {*} defaultValue - Default if not set
 * @returns {*}
 */
function getConfigValue(varName, defaultValue = null) {
  return process.env[varName] !== undefined ? process.env[varName] : defaultValue;
}

module.exports = {
  validateEnvironment,
  validateRequired,
  validateRecommended,
  logEnvironmentSummary,
  isModuleEnabled,
  isFeatureEnabled,
  getConfigValue,
  REQUIRED_VARS,
  RECOMMENDED_VARS
};
