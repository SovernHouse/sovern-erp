const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger.js');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000);
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100);

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === 'test';

// ===== IP-based Rate Limiters =====

const generalLimiter = rateLimit({
  windowMs: windowMs,
  max: maxRequests,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Production cap was 5/15min which is too tight for legitimate
  // dev + ops use (every Claude Desktop restart attempts an auth, and
  // a deploy spins through 1-2 attempts on its own). Bumping to 20.
  // Still well under brute-force territory for a single admin account.
  max: isDev ? 100 : 20,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user ? true : false
});

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: 'Too many resources created, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const fileLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many file uploads, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// ===== User-based Rate Limiting =====

/**
 * Per-user rate limiter with role-based limits
 * Tracks requests per authenticated user ID
 * Falls back to IP-based limiting for unauthenticated requests
 */
class UserRateLimiter {
  constructor() {
    // Store: Map<userId|ip, { requests: [timestamp, ...], resetTime }>
    this.store = new Map();

    // Role-based limits (requests per minute)
    this.roleLimits = {
      admin: parseInt(process.env.RATE_LIMIT_ADMIN || 200),
      sales: parseInt(process.env.RATE_LIMIT_SALES || 100),
      operations: parseInt(process.env.RATE_LIMIT_OPERATIONS || 100),
      finance: parseInt(process.env.RATE_LIMIT_FINANCE || 100),
      inspector: parseInt(process.env.RATE_LIMIT_INSPECTOR || 80),
      customer: parseInt(process.env.RATE_LIMIT_CUSTOMER || 60),
      factory: parseInt(process.env.RATE_LIMIT_FACTORY || 60),
      unauthenticated: parseInt(process.env.RATE_LIMIT_UNAUTHENTICATED || 30)
    };

    this.windowMs = 60 * 1000; // 1 minute window

    // Cleanup old entries every 5 minutes
    if (process.env.NODE_ENV !== 'test') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * Get limit for a user based on role
   */
  getLimitForUser(user) {
    if (!user) {
      return this.roleLimits.unauthenticated;
    }
    return this.roleLimits[user.role] || this.roleLimits.customer;
  }

  /**
   * Get key for storage (userId or IP)
   */
  getKey(req) {
    if (req.user && req.user.id) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  }

  /**
   * Check if request is allowed
   * Returns { allowed: boolean, remaining: number, resetTime: Date, limit: number }
   */
  checkLimit(req) {
    const key = this.getKey(req);
    const now = Date.now();
    const limit = this.getLimitForUser(req.user);
    const windowStart = now - this.windowMs;

    // Get or create entry
    let entry = this.store.get(key);
    if (!entry) {
      entry = {
        requests: [],
        resetTime: new Date(now + this.windowMs)
      };
      this.store.set(key, entry);
    }

    // Clean up old requests outside window
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    const currentCount = entry.requests.length;
    const allowed = currentCount < limit;

    // Add current request timestamp
    entry.requests.push(now);
    entry.resetTime = new Date(now + this.windowMs);

    return {
      allowed,
      remaining: Math.max(0, limit - currentCount - 1),
      resetTime: entry.resetTime,
      limit,
      current: currentCount + 1
    };
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, entry] of this.store.entries()) {
      // Remove entries where resetTime has passed
      if (entry.resetTime.getTime() < now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.store.delete(key));

    if (keysToDelete.length > 0) {
      logger.info(`Rate limiter cleanup: removed ${keysToDelete.length} entries`);
    }
  }

  /**
   * Middleware function
   */
  middleware() {
    return (req, res, next) => {
      const result = this.checkLimit(req);

      // Set response headers
      res.set('X-RateLimit-Limit', result.limit);
      res.set('X-RateLimit-Remaining', result.remaining);
      res.set('X-RateLimit-Reset', result.resetTime.toISOString());

      if (!result.allowed) {
        res.set('Retry-After', Math.ceil(result.resetTime.getTime() / 1000));
        return res.status(429).json({
          error: 'Too many requests, please try again later',
          retryAfter: result.resetTime.toISOString(),
          resetTime: result.resetTime
        });
      }

      next();
    };
  }

  /**
   * Get stats for a key (for monitoring)
   */
  getStats(key) {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    return {
      key,
      requestCount: entry.requests.length,
      resetTime: entry.resetTime,
      windowMs: this.windowMs
    };
  }

  /**
   * Get all stats (for monitoring)
   */
  getAllStats() {
    const stats = [];
    for (const [key, entry] of this.store.entries()) {
      stats.push({
        key,
        requestCount: entry.requests.length,
        resetTime: entry.resetTime
      });
    }
    return stats;
  }
}

// Create instances
const userRateLimiter = new UserRateLimiter();

/**
 * User-based rate limiting middleware
 * Can be applied to specific routes requiring stricter limi