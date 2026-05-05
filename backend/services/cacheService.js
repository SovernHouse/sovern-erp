const logger = require('../utils/logger.js');
/**
 * In-memory cache service for Trading ERP
 * Can be swapped with Redis in production
 *
 * Features:
 * - TTL support (default 5 minutes)
 * - Automatic cleanup of expired entries
 * - Cache statistics (hits/misses)
 * - Pattern-based cache invalidation
 * - Cache-through helper for simplified usage
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    // Start automatic cleanup interval (every 60 seconds) - skip in test env
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds (default 300)
   */
  set(key, value, ttlSeconds = 300) {
    const expiresAt = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null;

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });

    this.stats.sets++;
  }

  /**
   * Delete a specific cache key
   * @param {string} key - Cache key to delete
   */
  del(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * Delete all keys matching a pattern (supports wildcards)
   * @param {string|RegExp} pattern - Pattern to match keys
   * @returns {number} Number of keys deleted
   */
  delPattern(pattern) {
    const regex = typeof pattern === 'string'
      ? new RegExp(pattern.replace(/\*/g, '.*'))
      : pattern;

    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
        this.stats.deletes++;
      }
    }

    return deletedCount;
  }

  /**
   * Clear all cache entries
   */
  flush() {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.deletes += size;
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats including hits, misses, and current size
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0
      ? ((this.stats.hits / totalRequests) * 100).toFixed(2)
      : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      totalRequests,
      hitRate: parseFloat(hitRate),
      size: this.cache.size,
      memoryEstimate: this._estimateMemory()
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
    const cached = this.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const value = await fn();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Cleanup expired entries
   * @private
   */
  _cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`[Cache] Cleaned up ${cleanedCount} expired entries`);
    }
  }

  /**
   * Estimate memory usage (rough estimate)
   * @private
   */
  _estimateMemory() {
    let bytes = 0;
    for (const [key, entry] of this.cache.entries()) {
      bytes += key.length * 2; // Rough estimate for string
      bytes += JSON.stringify(entry.value).length * 2;
    }
    return bytes;
  }

  /**
   * Shutdown and cleanu