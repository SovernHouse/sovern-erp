/**
 * SSL/TLS Configuration
 * Handles HTTPS setup with support for both production and self-signed certificates
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const logger = require('../utils/logger.js');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Load SSL certificate and key
 * Supports both file paths and inline PEM strings
 *
 * Environment variables:
 * - SSL_CERT_PATH: Path to certificate file
 * - SSL_KEY_PATH: Path to private key file
 * - SSL_CA_PATH: Path to CA certificate (optional)
 * - SSL_CERT: Inline certificate (alternative to SSL_CERT_PATH)
 * - SSL_KEY: Inline private key (alternative to SSL_KEY_PATH)
 */
function loadSSLCredentials() {
  const certPath = process.env.SSL_CERT_PATH;
  const keyPath = process.env.SSL_KEY_PATH;
  const caPath = process.env.SSL_CA_PATH;

  try {
    let cert, key, ca = null;

    // Load certificate
    if (process.env.SSL_CERT) {
      cert = process.env.SSL_CERT;
    } else if (certPath && fs.existsSync(certPath)) {
      cert = fs.readFileSync(certPath, 'utf8');
    } else {
      throw new Error(`Certificate not found: ${certPath || 'SSL_CERT env var not set'}`);
    }

    // Load private key
    if (process.env.SSL_KEY) {
      key = process.env.SSL_KEY;
    } else if (keyPath && fs.existsSync(keyPath)) {
      key = fs.readFileSync(keyPath, 'utf8');
    } else {
      throw new Error(`Private key not found: ${keyPath || 'SSL_KEY env var not set'}`);
    }

    // Load CA certificate if provided
    if (caPath && fs.existsSync(caPath)) {
      ca = fs.readFileSync(caPath, 'utf8');
    }

    return { cert, key, ca };
  } catch (error) {
    throw new Error(`Failed to load SSL credentials: ${error.message}`);
  }
}

/**
 * Create HTTPS server
 * @param {object} app - Express application
 * @param {object} options - Additional options
 * @returns {https.Server}
 */
function createHTTPSServer(app, options = {}) {
  try {
    const { cert, key, ca } = loadSSLCredentials();

    const sslOptions = {
      cert,
      key,
      ...options
    };

    if (ca) {
      sslOptions.ca = ca;
    }

    // Add SSL protocol and cipher recommendations for production
    if (process.env.NODE_ENV === 'production') {
      sslOptions.minVersion = 'TLSv1.2';
      sslOptions.ciphers = [
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES128-GCM-SHA256'
      ].join(':');
    }

    const server = https.createServer(sslOptions, app);

    logger.info('[SSL] ✓ HTTPS server created with SSL/TLS enabled');
    return server;
  } catch (error) {
    logger.error('[SSL] ✗ Failed to create HTTPS server:', error.message);
    throw error;
  }
}

/**
 * Check if SSL is enabled
 * @returns {boolean}
 */
function isSSLEnabled() {
  return !!(process.env.SSL_CERT_PATH || process.env.SSL_KEY_PATH || process.env.SSL_CERT || process.env.SSL_KEY);
}

/**
 * Get SSL status information
 * @returns {object}
 */
function getSSLStatus() {
  const enabled = isSSLEnabled();

  return {
    enabled,
    certPath: process.env.SSL_CERT_PATH,
    keyPath: process.env.SSL_KEY_PATH,
    caPath: process.env.SSL_CA_PATH,
    environment: process.env.NODE_ENV,
    protocol: enabled ? 'HTTPS' : 'HTTP',
    minTLSVersion: process.env.NODE_ENV === 'production' ? '1.2' : 'Not enforced'
  };
}

/**
 * Generate a self-signed certificate for development
 * This is ONLY for development/testing
 */
function generateSelfSignedCert() {
  const { execSync } = require('child_process');
  const certDir = path.join(__dirname, '../certs');

  try {
    // Create certs directory if it doesn't exist
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    const certPath = path.join(certDir, 'server.crt');
    const keyPath = path.join(certDir, 'server.key');

    // Skip if already exists
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      logger.info('[SSL] Self-signed certificate already exists at:', certPath);
      return { certPath, keyPath };
    }

    // Generate self-signed certificate valid for 365 days
    const cmd = `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`;

    logger.info('[SSL] Generating self-signed certificate for development...');
    execSync(cmd, { stdio: 'inherit' });

    logger.info('[SSL] ✓ Self-signed certificate generated successfully');
    logger.info(`[SSL] Certificate: ${certPath}`);
    logger.info(`[SSL] Private Key: ${keyPath}`);

    return { certPath, keyPath };
  } catch (error) {
    logger.error('[SSL] ✗ Failed to generate self-signed certificate:', error.message);
    logger.error('[SSL] Make sure OpenSSL is installed on your system');
    throw error;
  }
}

/**
 * Middleware to enforce HTTPS in production
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Next middleware
 */
function enforceHTTPS(req, res, next) {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
}

/**
 * Middleware to add HSTS header
 * Tells browsers to only use HTTPS for this domain
 */
function addHSTSHeader(req, res, next) {
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  next();
}

/**
 * Middleware to add security headers
 */
function addSecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-o