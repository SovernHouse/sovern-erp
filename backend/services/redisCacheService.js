/**
 * Redis cache service for Trading ERP
 * Falls back to in-memory cache if Redis is unavailable
 *
 * Features:
 * - TTL support (default 5 minutes)
 * - Pattern-based cache invalidation via SCAN
 * - Cache statistics (hits/misses)
 * - Automatic fallback to in-memory cache
 * - Connection pooling and health checks
 */

const Redis = require('ioredis');
const CacheService = require('./cacheService');
const logger = require('../utils/logger.js');

class RedisCacheService {
  constructor(redisUrl = process.env.REDIS_URL) {
    this.redisUrl = redisUrl;
    this.redis = null;
    this.fallback = CacheService; // In-memory fallback
    this.isAvailable = false;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      fallbackHits: 0,
      fallbackMisses: 0
    };

    // Initialize Redis if URL is provided
    if (redisUrl) {
      this._initializeRedis();
    } else {
      logger.info('[Cache] Redis URL not configured, using in-memory cache');
      this.isAvailable = false;
    }
  }

  /**
   * Initialize Redis connection
   * @private
   */
  _initializeRedis() {
    try {
      this.redis = new Redis(this.redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true,
        lazyConnect: false
      });

      this.redis.on('connect', () => {
        logger.info('[Cache] Connected to Redis');
        this.isAvailable = true;
      });

      this.redis.on('error', (err) => {
        logger.error('[Cache] Redis error:', err.message);
        this.isAvailable = false;
      });

      this.redis.on('close', () => {
        logger.info('[Cache] Redis connection closed');
        this.isAvailable = false;
      });

      // Test connection immediately
      this.redis.ping()
        .then(() => {
          logger.info('[Cache] Redis is ready');
          this.isAvailable = true;
        })
        .catch((err) => {
          logger.error('[Cache] Redis connection failed:', err.message);
          this.isAvailable = false;
        });

    } catch (err) {
      logger.error('[Cache] Failed to initialize Redis:', err.message);
      this.isAvailable = false;
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<*>} Cached value or undefined
   */
  async get(key) {
    if (!this.isAvailable || !this.redis) {
      const result = this.fallback.get(key);
      if (result !== undefined) {
        this.stats.fallbackHits++;
      } else {
        this.stats.fallbackMisses++;
      }
      return result;
    }

    try {
      const value = await this.redis.get(key);

      if (value === null) {
        this.stats.misses++;
        return undefined;
      }

      this.stats.hits++;
      try {
        return JSON.parse(value);
      } catch {
        // Return raw value if not JSON
        return value;
      }
    } catch (err) {
      logger.error('[Cache] Redis get error:', err.message);
      // Fallback to in-memory
      const result = this.fallback.get(key);
      if (result !== undefined) {
        this.stats.fallbackHits++;
      } else {
        this.stats.fallbackMisses++;
      }
      return result;
    }
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds (default 300)
   * @returns {Promise<void>}
   */
  async set(key, value, ttlSeconds = 300) {
    if (!this.isAvailable || !this.redis) {
      this.fallback.set(key, value, ttlSeconds);
      this.stats.sets++;
      return;
    }

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttlSeconds > 0) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      this.stats.sets++;
    } catch (err) {
      logger.error('[Cache] Redis set error:', err.message);
      // Fallback to in-memory
      this.fallback.set(key, value, ttlSeconds);
    }
  }

  /**
   * Delete a specific cache key
   * @param {string} key - Cache key to delete
   * @returns {Promise<boolean>}
   */
  async del(key) {
    if (!this.isAvailable || !this.redis) {
      const deleted = this.fallback.del(key);
      if (deleted) {
        this.stats.deletes++;
      }
      return deleted;
    }

    try {
      const result = await this.redis.del(key);
      if (result > 0) {
        this.stats.deletes++;
      }
      return result > 0;
    } catch (err) {
      logger.error('[Cache] Redis del error:', err.message);
      // Fallback to in-memory
      const deleted = this.fallback.del(key);
      if (deleted) {
        this.stats.deletes++;
      }
      return deleted;
    }
  }

  /**
   * Delete all keys matching a pattern using SCAN
   * @param {string|RegExp} pattern - Pattern to match keys
   * @returns {Promise<number>} Number of keys deleted
   */
  async delPattern(pattern) {
    if (!this.isAvailable || !this.redis) {
      return this.fallback.delPattern(pattern);
    }

    try {
      let deletedCount = 0;
      let cursor = '0';
      const regex = typeof pattern === 'string'
        ? new RegExp(pattern.replace(/\*/g, '.*'))
        : pattern;

      do {
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          '*',
          'COUNT',
          '100'
        );

        cursor = newCursor;

        for (const key of keys) {
          if (regex.test(key)) {
            await this.redis.del(key);
            deletedCount++;
          }
        }
      } while (cursor !== '0');

      if (deletedCount > 0) {
        this.stats.deletes += deletedCount;
      }

      return deletedCount;
    } catch (err) {
      logger.error('[Cache] Redis delPattern error:', err.message);
      // Fallback to in-memory
      return this.fallback.delPattern(pattern);
    }
  }

  /**
   * Clear all cache entries
   * @returns {Promise<void>}
   */
  async flush() {
    if (!this.isAvailable || !this.redis) {
      this.fallback.flush();
      return;
    }

    try {
      await this.redis.flushdb();
      logger.info('[Cache] Cache flushed');
    } catch (err) {
      logger.error('[Cache] Redis flush error:', err.message);
      // Fallback to in-memory
      this.fallback.flush();
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<object>} Cache stats
   */
  async getStats() {
    let redisInfo = {};

    if (this.isAvailable && this.redis) {
      try {
        const info = await this.redis.info('stats');
        const lines = info.split('\r\n');
        for (const line of lines) {
          const [key, value] = line.split(':');
          if (key && value) {
            redisInfo[key] = value;
          }
        }
      } catch (err) {
        logger.error('[Cache] Failed to get Redis info:', err.message);
      }
    }

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0
      ? ((this.stats.hits / totalRequests) * 100).toFixed(2)
      : 0;

    return {
      backend: this.isAvailable ? 'redis' : 'in-memory',
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      fallbackHits: this.stats.fallbackHits,
      fallbackMisses: this.stats.fallbackMisses,
      totalRequests,
      hitRate: parseFloat(hitRate),
      redisInfo
    };
  }

  /**
   * Cache-through pattern: return cached value or compute and cache
   * @param {string} key - Cache key
   * @param {Function} fn - Async function to compute value if not cached
   * @param {number} ttlSeconds - TTL in seconds (default 300)
   * @returns {Promise<*>} Cached or computed value
   */
  async wrap(key, fn, ttlSeconds = 300) {
    const cached = await this.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Shutdown and cleanup
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.redis && this.isAvailable) {
      try {
        await this.redis.quit();
        logger.info('[Cache] Redis connection closed gracefully');
      } catch (err) {
        logger.error('[Cache] Error closing Redis:', err.message);
        await this.redis.disconnect();
      }
    }
    this.fallback.shutdown();
  }
}

// Factory function to create cache service based on environment
function createCacheService() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    logger.info('[Cache] Initializing Redis cache service');
    return new RedisCacheService(redisUrl);
  } else {
    logger.info('[Cache] Redis not configured, using in-memory cache');
    return CacheService;
  }
}

module.exports = {
  RedisCacheService,
  createCacheService,
  getInstance: () => {
    // Lazy initialization
    if (!module.exports._instance) {
      module.exports._instance = createCacheService();
    }
    return module.exports._instance;
  }
};
