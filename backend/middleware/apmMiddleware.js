/**
 * APM Middleware
 * Records request metrics and detects slow requests
 */

const apmService = require('../services/apmService');
const logger = require('../utils/logger.js');

/**
 * Extract route pattern from req.route.path
 * Converts /api/users/:id/posts/:postId to /api/users/:id/posts/:postId
 * This prevents metric fragmentation from specific IDs
 *
 * @param {Object} req - Express request object
 * @returns {string} Route pattern or original path
 */
const getRoutePath = (req) => {
  // If matched route exists, use it (has route parameters normalized)
  if (req.route && req.route.path) {
    return req.route.path;
  }

  // Otherwise use the original path
  // This happens for 404s and dynamic routes
  return req.path || req.originalUrl;
};

/**
 * APM Middleware - Records request metrics
 */
const apmMiddleware = (req, res, next) => {
  // Record start time using high-resolution timer
  const startTime = process.hrtime();
  const startMs = Date.now();

  // Capture the original send function
  const originalSend = res.send;

  // Override the send function to capture response
  res.send = function (data) {
    // Calculate response time
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTimeMs = Math.round(seconds * 1000 + nanoseconds / 1000000);

    // Get the route path pattern
    const routePath = getRoutePath(req);

    // Record the metric
    apmService.recordRequest(
      req.method,
      routePath,
      res.statusCode,
      responseTimeMs
    );

    // Log slow requests to console
    if (responseTimeMs > 2000) {
      logger.warn(
        `[SLOW REQUEST] ${req.method} ${routePath} - ${res.statusCode} ${responseTimeMs}ms`
      );
    }

    // Call the original send
    return originalSend.call(this, data);
  };

  // Override json function as well (Express uses both send and json)
  const originalJson = res.json;

  res.json = function (data) {
    // Calculate response time
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTimeMs = Math.round(seconds * 1000 + nanoseconds / 1000000);

    // Get the route path pattern
    const routePath = getRoutePath(req);

    // Record the metric
    apmService.recordRequest(
      req.method,
      routePath,
      res.statusCode,
      responseTimeMs
    );

    // Log slow requests
    if (responseTimeMs > 2000) {
      logger.warn(
        `[SLOW REQUEST] ${req.method} ${routePath} - ${res.statusCode} ${responseTimeMs}ms`
      );
    }

    // Call the original json
    return originalJson.call(this, data);
  };

  next();
};

module.exports = apmMiddleware;
