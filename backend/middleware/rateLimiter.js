const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger.js');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000);
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100);

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === 'test';

// ===== IP-based Rate Limiters =====

// Phase 4.9.4: idempotent poll endpoints — dashboards and mobile
// shells hit these every 15-30s before auth attaches, so they MUST
// NOT count against the IP bucket. Adding a benign read here is
// safe; do NOT add any write-side path.
const POLL_EXEMPT_PATHS = ['/api/health', '/api/notifications', '/health'];

function isPollPath(req) {
  // express-rate-limit's req.path is the path AFTER the mount point
  // (so `/health` when mounted at /api/, and `/api/health` if globally
  // mounted). Compare both forms to be safe across mount-point changes.
  const p = req.path || req.originalUrl?.split('?')[0] || '';
  return POLL_EXEMPT_PATHS.some(ex => p === ex || (req.originalUrl || '').split('?')[0] === ex);
}

// Phase 4.9.4: in-memory snapshot of the most recent 429s and current
// bucket counts. Exposed via /api/admin/ratelimit-stats so future
// debugging doesn't need pm2 restart + log spelunking.
const generalLimiter429Log = [];
const generalLimiterBuckets = new Map(); // ip → { count, windowStart }

function recordGeneralLimiter429(req) {
  const entry = {
    ip: req.ip,
    path: req.path,
    originalUrl: req.originalUrl,
    userId: req.user?.id || null,
    at: new Date().toISOString(),
  };
  generalLimiter429Log.push(entry);
  // Cap the in-memory log so it doesn't grow unbounded.
  if (generalLimiter429Log.length > 200) {
    generalLimiter429Log.splice(0, generalLimiter429Log.length - 200);
  }
}

const generalLimiter = rateLimit({
  windowMs: windowMs,
  max: maxRequests,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Phase 4.9.4 PART A + B:
  //   1. Poll endpoints are skipped unconditionally (their cadence is
  //      the desktop/mobile shell, not abuse traffic).
  //   2. Authenticated requests skip the IP-based bucket entirely;
  //      they go through userRateLimiter downstream. attachUserIfPresent
  //      runs before this middleware so req.user is populated when a
  //      valid bearer token is on the request.
  skip: (req) => {
    if (isPollPath(req)) return true;
    if (req.user && req.user.id) return true;
    return false;
  },
  handler: (req, res, _next, options) => {
    // Phase 4.9.4 PART C: log the IP + path + bucket count so the next
    // self-DOS surfaces as evidence in the logs, not a black box.
    const bucket = generalLimiterBuckets.get(req.ip);
    logger.warn(`[rateLimiter] 429 ip=${req.ip} path=${req.path} userId=${req.user?.id || 'anon'} bucketCount=${bucket?.count ?? '?'}`);
    recordGeneralLimiter429(req);
    res.status(options.statusCode).json({ error: options.message });
  },
  // Increment our visibility-only bucket each time the limiter sees
  // a request. express-rate-limit's internal store is opaque; this
  // keeps a parallel count we can show on the admin stats page.
  // Note: skipped requests don't trigger this; that's intentional —
  // we want the bucket count to reflect what would actually limit.
  keyGenerator: (req) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const existing = generalLimiterBuckets.get(ip);
    if (!existing || now - existing.windowStart > windowMs) {
      generalLimiterBuckets.set(ip, { count: 1, windowStart: now });
    } else {
      existing.count += 1;
    }
    return ip;
  },
});

function getGeneralLimiterStats() {
  // Cleanup expired buckets before returning.
  const now = Date.now();
  for (const [ip, entry] of generalLimiterBuckets.entries()) {
    if (now - entry.windowStart > windowMs) generalLimiterBuckets.delete(ip);
  }
  return {
    windowMs,
    maxRequests,
    bucketCount: generalLimiterBuckets.size,
    buckets: Array.from(generalLimiterBuckets.entries()).map(([ip, b]) => ({
      ip, count: b.count, windowStart: new Date(b.windowStart).toISOString(),
    })),
    recent429s: generalLimiter429Log.slice(-50),
    pollExemptPaths: POLL_EXEMPT_PATHS,
  };
}

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
 * Can be applied to specific routes requiring stricter limits
 */
const userRateLimitMiddleware = userRateLimiter.middleware();

module.exports = {
  generalLimiter,
  authLimiter,
  createLimiter,
  fileLimiter,
  userRateLimiter,
  userRateLimitMiddleware,
  UserRateLimiter,
  // Phase 4.9.4
  getGeneralLimiterStats,
  POLL_EXEMPT_PATHS,
  isPollPath,
};
