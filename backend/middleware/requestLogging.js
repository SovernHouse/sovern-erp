/**
 * Request Logging Middleware
 * @module middleware/requestLogging
 * @description Structured request/response logging with Winston
 */

const logger = require('../utils/logger');

/**
 * Request logging middleware
 * Logs all incoming requests and outgoing responses
 */
const requestLogging = (req, res, next) => {
  const start = Date.now();
  const requestId = req.id || 'unknown';

  // Log incoming request
  logger.info(`[${requestId}] ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id || 'anonymous'
  });

  // Only intercept res.end to log the response.
  // Do NOT override res.json — it calls res.send internally, which calls res.end,
  // so the end handler below already captures every JSON response. Overriding
  // res.json here too creates a double-chain when combined with apmMiddleware.
  const originalEnd = res.end.bind(res);

  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;

    // Log response
    logger.info(`[${requestId}] Response ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || 'anonymous'
    });

    return originalEnd(chunk, encoding);
  };

  next();
};

module.exports = { requestLogging };
