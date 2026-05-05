/**
 * Cache middleware for Express routes
 * Provides route-level caching for GET requests
 * Supports both Redis and in-memory caching
 */

const { getInstance: getCacheService } = require('../services/redisCacheService');
const logger = require('../utils/logger.js');

/**
 * Generate cache key from request
 * @param {object} req - Express request
 * @returns {string} Cache key
 */
function generateCacheKey(req) {
  const params = new URLSearchParams(req.query);
  const queryString = params.toString();
  return `route:${req.originalUrl}`;
}

/**
 * Cache middleware for GET request responses
 * Only caches 200 responses, respects cache-control headers
 * Supports both Redis and in-memory caching
 *
 * @param {number} ttlSeconds - Time to live in seconds (default 300)
 * @returns {Function} Express middleware
 */
function cacheRoute(ttlSeconds = 300) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if client requested no-cache
    if (req.headers['cache-control'] === 'no-cache') {
      return next();
    }

    const cacheService = getCacheService();
    const cacheKey = generateCacheKey(req);

    // Check for cached response
    try {
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        res.set('X-Cache', 'HIT');
        return res.json(cachedData);
      }
    } catch (err) {
      logger.error('[Cache] Error retrieving from cache:', err.message);
      // Continue without cache on error
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);

    res.json = async function (data) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        try {
          await cacheService.set(cacheKey, data, ttlSeconds);
        } catch (err) {
          logger.error('[Cache] Error setting cache:', err.message);
          // Continue even if cache fails
        }
      }

      res.set('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

/**
 * Middleware to invalidate cache patterns after successful mutations
 * Use after PUT, POST, DELETE operations
 * Supports both Redis and in-memory caching
 *
 * @param {string|string[]} patterns - Patterns to invalidate (supports wildcards)
 * @returns {Function} Express middleware
 */
function invalidateCache(patterns) {
  return (req, res, next) => {
    // Hook into response finish to invalidate after successful operation
    res.on('finish', async () => {
      // Only invalidate on successful responses (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheService = getCacheService();
        const patternArray = Array.isArray(patterns) ? patterns : [patterns];

        for (const pattern of patternArray) {
          try {
            const deleted = await cacheService.delPattern(pattern);
            if (deleted > 0) {
              logger.info(`[Cache] Invalidated ${deleted} entries matching pattern: ${pattern}`);
            }
          } catch (err) {
            logger.error(`[Cache] Error invalidating pattern ${pattern}:`, err.message);
          }
        }
      }
    });

    next();
  };
}

/**
 * Get cache stats (useful for monitoring)
 * Supports both Redis and in-memory caching
 * @returns {Function} Express middleware
 */
function cacheStats() {
  return async (req, res, next) => {
    const cacheService = getCacheService();
    try {
      res.locals.cacheStats = await cacheService.getStats();
    } catch (err) {
      logger.error('[Cache] Error getting cache stats:', err.message);
      res.locals.cacheStats = {};
    }
    next();
  };
}

module.exports = {
  cacheRoute,
  invalidateCache,
  cacheStats,
  generateCacheKey
};
