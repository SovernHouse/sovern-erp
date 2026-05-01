/**
 * Sentry instrumentation. Required at the top of server.js BEFORE any other
 * import or require. Loading order is critical for Sentry's auto-instrumentation
 * of Express, HTTP, and other modules.
 *
 * DSN is read from the SENTRY_DSN environment variable. If unset, Sentry is
 * disabled (no events are sent), useful for local development without an
 * internet connection or for tests.
 */
require('dotenv').config();
const Sentry = require('@sentry/node');

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    // Performance monitoring sample rate. Free plan allows 10k transactions/month.
    // 0.1 = 10% of transactions sampled. Reduce if traffic grows.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Send default PII (IP, user agent). Disable if regulatory posture requires it.
    sendDefaultPii: true,
    // Don't send events from local development unless explicitly enabled.
    enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_FORCE_ENABLE === 'true',
    integrations: [
      // Express integration is auto-attached when @sentry/node is required first.
    ],
    // Filter known noisy errors. Add to this list if specific error types
    // generate too much volume on the free plan (5000 errors/month).
    ignoreErrors: [
      // Connection drops are common with Socket.IO clients reconnecting.
      'TransportError',
    ],
  });
}

module.exports = Sentry;
