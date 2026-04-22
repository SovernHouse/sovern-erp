/**
 * Pagination Middleware
 * Extracts and validates pagination params (page, limit) from query
 * Adds pagination metadata to responses
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * Extract pagination params from request query
 * Returns object with page, limit, and offset
 */
const extractPaginationParams = (query) => {
  let page = parseInt(query.page) || DEFAULT_PAGE;
  let limit = parseInt(query.limit) || DEFAULT_LIMIT;

  // Validate page
  if (page < 1) page = DEFAULT_PAGE;

  // Validate and cap limit
  if (limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Helper function to add pagination metadata to response
 * Call this in route handlers after querying the database
 */
const addPaginationMeta = (data, totalCount, page, limit) => {
  const totalPages = Math.ceil(totalCount / limit);

  return {
    success: true,
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: totalCount,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
};

/**
 * Express middleware to validate and store pagination params
 * Stores params in req.pagination for use by route handlers
 */
const paginationMiddleware = (req, res, next) => {
  req.pagination = extractPaginationParams(req.query);
  next();
};

module.exports = {
  paginationMiddleware,
  extractPaginationParams,
  addPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT
};
