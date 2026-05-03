/**
 * Application Performance Monitoring (APM) Service
 * Lightweight in-memory APM for tracking metrics, errors, and performance
 * Stores last 1 hour of detailed data, aggregates older data
 */

class APMService {
  constructor() {
    this.metrics = {
      requests: [],
      errors: [],
      slowRequests: [],
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0
    };

    // Configuration
    this.config = {
      slowQueryThreshold: 1000, // ms
      maxErrorsStored: 100,
      maxRequestsStored: 500,
      maxSlowRequestsStored: 100,
      dataRetentionHours: 1
    };

    // Start cleanup task (run every 10 minutes) - skip in test env to avoid Jest open handles
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupTask();
    }
  }

  /**
   * Record a request metric
   * @param {string} method - HTTP method
   * @param {string} path - Request path (should be route pattern, not specific ID)
   * @param {number} statusCode - Response status code
   * @param {number} responseTimeMs - Response time in milliseconds
   */
  recordRequest(method, path, statusCode, responseTimeMs) {
    try {
      const timestamp = Date.now();

      const request = {
        method,
        path,
        statusCode,
        responseTimeMs,
        timestamp,
        success: statusCode < 500  // 4xx are client errors (expected); only 5xx are server failures
      };

      // Add to main requests array
      this.metrics.requests.push(request);

      // Track slow requests separately
      if (responseTimeMs > this.config.slowQueryThreshold) {
        this.metrics.slowRequests.push({
          ...request,
          recordedAt: new Date(timestamp).toISOString()
        });

        // Keep only the slowest requests
        if (this.metrics.slowRequests.length > this.config.maxSlowRequestsStored) {
          this.metrics.slowRequests = this.metrics.slowRequests
            .sort((a, b) => b.responseTimeMs - a.responseTimeMs)
            .slice(0, this.config.maxSlowRequestsStored);
        }
      }

      // Maintain size limits
      if (this.metrics.requests.length > this.config.maxRequestsStored) {
        this.metrics.requests = this.metrics.requests.slice(-this.config.maxRequestsStored);
      }

      this.metrics.requestCount++;
    } catch (error) {
      console.error('[APM] Error recording request:', error.message);
    }
  }

  /**
   * Record an error
   * @param {Error} error - Error object
   * @param {Object} context - Additional context (path, method, statusCode, etc.)
   */
  recordError(error, context = {}) {
    try {
      const timestamp = Date.now();

      const errorRecord = {
        message: error.message || 'Unknown error',
        stack: error.stack || '',
        errorType: error.constructor.name,
        timestamp,
        recordedAt: new Date(timestamp).toISOString(),
        ...context
      };

      this.metrics.errors.push(errorRecord);
      this.metrics.errorCount++;

      // Maintain size limit (keep last N errors)
      if (this.metrics.errors.length > this.config.maxErrorsStored) {
        this.metrics.errors = this.metrics.errors.slice(-this.config.maxErrorsStored);
      }
    } catch (error) {
      console.error('[APM] Error recording error:', error.message);
    }
  }

  /**
   * Get comprehensive metrics
   * @returns {Object} Metrics summary
   */
  getMetrics() {
    try {
      const now = Date.now();
      const uptime = now - this.metrics.startTime;

      // Calculate metrics from requests
      const requests = this.metrics.requests;
      const recentRequests = requests.filter(r => now - r.timestamp < 3600000); // Last hour

      let successCount = 0;
      let errorCount = 0;
      let totalResponseTime = 0;
      const byEndpoint = {};
      const byStatusCode = {};

      recentRequests.forEach(req => {
        if (req.success) {
          successCount++;
        } else {
          errorCount++;
        }
        totalResponseTime += req.responseTimeMs;

        // Group by endpoint
        if (!byEndpoint[req.path]) {
          byEndpoint[req.path] = {
            count: 0,
            avgResponseTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0,
            errorCount: 0
          };
        }
        byEndpoint[req.path].count++;
        byEndpoint[req.path].errorCount += req.success ? 0 : 1;
        byEndpoint[req.path].minResponseTime = Math.min(
          byEndpoint[req.path].minResponseTime,
          req.responseTimeMs
        );
        byEndpoint[req.path].maxResponseTime = Math.max(
          byEndpoint[req.path].maxResponseTime,
          req.responseTimeMs
        );

        // Group by status code
        if (!byStatusCode[req.statusCode]) {
          byStatusCode[req.statusCode] = 0;
        }
        byStatusCode[req.statusCode]++;
      });

      // Calculate averages
      Object.keys(byEndpoint).forEach(endpoint => {
        const data = byEndpoint[endpoint];
        if (data.count > 0) {
          data.avgResponseTime = recentRequests
            .filter(r => r.path === endpoint)
            .reduce((sum, r) => sum + r.responseTimeMs, 0) / data.count;
        }
      });

      const avgResponseTime = recentRequests.length > 0
        ? totalResponseTime / recentRequests.length
        : 0;

      return {
        uptime: Math.floor(uptime / 1000), // seconds
        startTime: new Date(this.metrics.startTime).toISOString(),
        requests: {
          total: this.metrics.requestCount,
          lastHour: recentRequests.length,
          successful: successCount,
          failed: errorCount,
          avgResponseTime: Math.round(avgResponseTime),
          successRate: recentRequests.length > 0
            ? Math.round((successCount / recentRequests.length) * 100)
            : 0
        },
        errors: {
          total: this.metrics.errorCount,
          recent: this.metrics.errors.length
        },
        byEndpoint,
        byStatusCode,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('[APM] Error getting metrics:', error.message);
      return { error: 'Failed to get metrics' };
    }
  }

  /**
   * Get recent errors
   * @param {number} limit - Number of errors to return
   * @returns {Array} Array of errors
   */
  getErrors(limit = 50) {
    try {
      // Return most recent errors first
      return this.metrics.errors
        .slice()
        .reverse()
        .slice(0, limit);
    } catch (error) {
      console.error('[APM] Error getting errors:', error.message);
      return [];
    }
  }

  /**
   * Get slow requests
   * @param {number} limit - Number of slow requests to return
   * @returns {Array} Array of slow requests
   */
  getSlowRequests(limit = 20) {
    try {
      // Return sorted by response time, slowest first
      return this.metrics.slowRequests
        .sort((a, b) => b.responseTimeMs - a.responseTimeMs)
        .slice(0, limit);
    } catch (error) {
      console.error('[APM] Error getting slow requests:', error.message);
      return [];
    }
  }

  /**
   * Get system health information
   * @returns {Object} Health check data
   */
  getHealthCheck() {
    try {
      const memUsage = process.memoryUsage();
      const uptime = Date.now() - this.metrics.startTime;

      // Calculate error rate
      const requests = this.metrics.requests;
      const recentRequests = requests.filter(r => Date.now() - r.timestamp < 300000); // Last 5 minutes
      const errorRate = recentRequests.length > 0
        ? ((recentRequests.filter(r => !r.success).length) / recentRequests.length) * 100
        : 0;

      // Use RSS (Resident Set Size) — the actual physical RAM this process occupies.
      // heapUsed/heapTotal is V8 heap fill ratio; it naturally stays near 90% before GC
      // fires and is NOT a signal of memory pressure. RSS is the real footprint.
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      // Alert threshold: 500 MB RSS. A well-run Node ERP should stay under this.
      const RSS_ALERT_MB = parseInt(process.env.MEMORY_ALERT_RSS_MB || '500');
      const memPercent = Math.round((rssMB / RSS_ALERT_MB) * 100);

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime / 1000), // seconds
        nodejs: process.version,
        memory: {
          rss: rssMB,                // MB — actual process RAM usage
          heapUsed: heapUsedMB,      // MB
          heapTotal: heapTotalMB,    // MB
          external: Math.round(memUsage.external / 1024 / 1024), // MB
          percentUsed: memPercent,   // % of RSS alert threshold (500 MB default)
          isHealthy: rssMB < RSS_ALERT_MB
        },
        requests: {
          total: this.metrics.requestCount,
          last5min: recentRequests.length,
          errorRate5min: Math.round(errorRate)
        },
        errors: {
          total: this.metrics.errorCount,
          stored: this.metrics.errors.length
        }
      };
    } catch (error) {
      console.error('[APM] Error getting health check:', error.message);
      return {
        status: 'error',
        error: 'Failed to get health check'
      };
    }
  }

  /**
   * Reset all metrics (for testing)
   */
  reset() {
    try {
      this.metrics = {
        requests: [],
        errors: [],
        slowRequests: [],
        startTime: Date.now(),
        requestCount: 0,
        errorCount: 0
      };
      console.log('[APM] Metrics reset');
    } catch (error) {
      console.error('[APM] Error resetting metrics:', error.message);
    }
  }

  /**
   * Start cleanup task to remove old data
   * @private
   */
  startCleanupTask() {
    setInterval(() => {
      try {
        const now = Date.now();
        const retentionTime = this.config.dataRetentionHours * 3600000;

        // Clean old requests
        const initialRequestCount = this.metrics.requests.length;
        this.metrics.requests = this.metrics.requests.filter(
          r => now - r.timestamp < retentionTime
        );

        // Clean old errors
        const initialErrorCount = this.metrics.errors.length;
        this.metrics.errors = this.metrics.errors.filter(
          e => now - e.timestamp < retentionTime
        );

        // Clean old slow requests
        const initialSlowCount = this.metrics.slowRequests.length;
        this.metrics.slowRequests = this.metrics.slowRequests.filter(
          s => now - s.timestamp < retentionTime
        );

        if (initialRequestCount > this.metrics.requests.length ||
            initialErrorCount > this.metrics.errors.length ||
            initialSlowCount > this.metrics.slowRequests.length) {
          console.log('[APM] Cleanup: Removed old metrics');
        }
      } catch (error) {
        console.error('[APM] Error in cleanup task:', error.message);
      }
    }, 600000); // Run every 10 minutes
  }
}

// Export singleton instance
module.exports = new APMService();
