/**
 * Sentry instrumentation stub.
 *
 * @sentry/node v9 uses OpenTelemetry and hangs indefinitely on require() on
 * this Linux/Node environment before even reaching Sentry.init(). The stub
 * keeps server.js working (setupExpressErrorHandler is a no-op) until we
 * downgrade to @sentry/node v7 which doesn't have this issue.
 *
 * TODO: downgrade "@sentry/node" to "^7.0.0" in package.json, update this
 * file to use the real SDK, and update server.js to use
 * app.use(Sentry.Handlers.requestHandler()) / Sentry.Handlers.errorHandler().
 */
require('dotenv').config();

module.exports = {
  init: () => {},
  setupExpressErrorHandler: () => {},
  captureException: () => {},
  captureMessage: () => {},
};
