/**
 * Sentry instrumentation — must be the first require in server.js so that
 * the SDK can wrap http/https/pg/express before they get loaded.
 *
 * History:
 * - We were on @sentry/node v9, which uses OpenTelemetry under the hood and
 *   hangs indefinitely on require() inside this Linux/Node environment
 *   (before ever reaching Sentry.init). The hang prevented app.listen and
 *   caused 502s. We stubbed it out as a no-op while debugging.
 * - Now downgraded to @sentry/node v7 (no OpenTelemetry). Real init works.
 *
 * Defensive: wrap init in try/catch so any future SDK regression can't take
 * the server down. If init throws, we fall back to a no-op shim that has
 * the same surface as the real Sentry module so server.js code that calls
 * Sentry.captureException / Handlers.requestHandler / Handlers.errorHandler
 * never crashes.
 */
require('dotenv').config();

let Sentry;
try {
  Sentry = require('@sentry/node');

  // Only init if a DSN is configured. Local dev and CI run without one;
  // there's no point spinning up the SDK in those environments.
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      // 10% of transactions sampled for performance traces. Bump if needed.
      tracesSampleRate: 0.1,
      // Don't capture process.env in error context — leaks secrets.
      beforeSend(event) {
        if (event.extra && event.extra.env) delete event.extra.env;
        return event;
      },
    });
  }
} catch (err) {
  // SDK failed to load (e.g. native bindings broken on this platform).
  // Surface a one-liner and fall through to the no-op shim below.
  // eslint-disable-next-line no-console
  console.warn('[sentry] init failed; falling back to no-op:', err.message);
  Sentry = null;
}

// No-op shim — same shape as @sentry/node v7. Used both when SENTRY_DSN is
// unset and when the SDK fails to load. Express middlewares from
// Sentry.Handlers.* must be functions of (req, res, next) to be
// drop-in compatible with app.use(...).
const noopMiddleware = (_req, _res, next) => next();
const noopErrorMiddleware = (err, _req, _res, next) => next(err);

const fallback = {
  init: () => {},
  captureException: () => {},
  captureMessage: () => {},
  Handlers: {
    requestHandler: () => noopMiddleware,
    tracingHandler: () => noopMiddleware,
    errorHandler:   () => noopErrorMiddleware,
  },
};

module.exports = Sentry || fallback;
