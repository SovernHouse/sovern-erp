/**
 * Request Timeout Middleware
 * Adds configurable timeout to requests to prevent hanging
 * Default: 30 seconds
 */

const { AppError } = require('./errorHandler');

/**
 * Creates timeout middleware with configurable duration
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns {function} Express middleware
 */
const createTimeoutMiddleware = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        const error = new AppError(
          `Request timeout after ${timeoutMs / 1000} seconds`,
          408
        );
        return next(error);
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => clearTimeout(timeoutId));
    res.on('close', () => clearTimeout(timeoutId));

    next();
  };
};

// Default 30-second timeout middleware
const requestTimeoutMiddleware = createTimeoutMiddleware(30000);

module.exports = {
  requestTimeoutMiddleware,
  createTimeoutMiddleware
};
