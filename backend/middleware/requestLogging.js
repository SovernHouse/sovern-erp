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

  // Capture original res.json and res.end
  const originalJson = res.json.bind(res);
  const originalEnd = res.end.bind(res);

  res.json = function(data) {
    res.locals.jsonData = data;
    return originalJson(data);
  };

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
