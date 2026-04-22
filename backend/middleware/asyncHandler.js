/**
 * Async Handler Middleware
 * Wraps async route handlers to automatically catch errors
 * Eliminates need for try-catch blocks in routes
 */

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
