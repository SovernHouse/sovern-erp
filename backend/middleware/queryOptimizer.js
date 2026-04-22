/**
 * Query optimization middleware and utilities for Sequelize
 * Helps optimize database queries for performance
 */

/**
 * Optimize Sequelize query by limiting selected columns
 * @param {object} model - Sequelize model
 * @param {object} options - Query options
 * @param {array} attributesToSelect - Specific attributes to select (default: all)
 * @returns {object} Optimized options object
 */
function optimizeQuery(model, options, attributesToSelect = null) {
  const optimized = { ...options };

  // Add attributes to limit SELECT columns (unless specifically all are needed)
  if (attributesToSelect && Array.isArray(attributesToSelect) && attributesToSelect.length > 0) {
    optimized.attributes = attributesToSelect;
  }

  // Ensure limit is reasonable
  if (optimized.limit && optimized.limit > 1000) {
    console.warn(`[Query Optimizer] Limit ${optimized.limit} exceeds recommended max (1000)`);
    optimized.limit = 1000;
  }

  // Ensure offset is used with limit
  if (optimized.offset && !optimized.limit) {
    optimized.limit = 20; // Set sensible default
  }

  return optimized;
}

/**
 * Middleware to add pagination defaults to request
 * Sets sensible defaults for page/limit parameters
 *
 * @returns {Function} Express middleware
 */
function addPaginationDefaults() {
  return (req, res, next) => {
    // Extract pagination params
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;

    // Validate and enforce limits
    if (page < 1) page = 1;
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100; // Max 100 per page

    // Calculate offset
    const offset = (page - 1) * limit;

    // Attach to request for use in controllers
    req.pagination = {
      page,
      limit,
      offset
    };

    next();
  };
}

/**
 * Get safe sort order for queries
 * Validates sort field and direction to prevent SQL injection
 *
 * @param {object} req - Express request
 * @param {string[]} allowedFields - Array of allowed sort fields
 * @param {string} defaultField - Default sort field (default: 'createdAt')
 * @param {string} defaultDirection - Default sort direction: 'ASC' or 'DESC' (default: 'DESC')
 * @returns {array} Array suitable for Sequelize order option, e.g., [['field', 'DESC']]
 */
function getSortOrder(req, allowedFields = [], defaultField = 'createdAt', defaultDirection = 'DESC') {
  const sortField = req.query.sort || defaultField;
  const sortDir = (req.query.direction || defaultDirection).toUpperCase();

  // Validate field
  if (allowedFields.length > 0 && !allowedFields.includes(sortField)) {
    console.warn(`[Query Optimizer] Invalid sort field: ${sortField}, using default: ${defaultField}`);
    return [[defaultField, sortDir]];
  }

  // Validate direction
  if (!['ASC', 'DESC'].includes(sortDir)) {
    console.warn(`[Query Optimizer] Invalid sort direction: ${sortDir}, using default: ${defaultDirection}`);
    return [[sortField, defaultDirection]];
  }

  return [[sortField, sortDir]];
}

/**
 * Middleware combining pagination and sort validation
 * Adds safe pagination and sorting to request object
 *
 * @returns {Function} Express middleware
 */
function queryDefaults() {
  return (req, res, next) => {
    // Add pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;

    if (page < 1) page = 1;
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;

    const offset = (page - 1) * limit;

    // Add sort
    const sortField = req.query.sort || 'createdAt';
    const sortDir = (req.query.direction || 'DESC').toUpperCase();

    if (!['ASC', 'DESC'].includes(sortDir)) {
      req.query.direction = 'DESC';
    }

    req.pagination = { page, limit, offset };
    req.sort = { field: sortField, direction: sortDir };

    next();
  };
}

/**
 * Middleware to log slow queries (for monitoring)
 * @param {number} thresholdMs - Threshold in milliseconds (default: 1000)
 * @returns {Function} Express middleware
 */
function logSlowQueries(thresholdMs = 1000) {
  return (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      if (duration > thresholdMs) {
        console.warn(`[Query Slow] ${req.method} ${req.originalUrl} took ${duration}ms`);
      }
    });

    next();
  };
}

module.exports = {
  optimizeQuery,
  addPaginationDefaults,
  getSortOrder,
  queryDefaults,
  logSlowQueries
};
