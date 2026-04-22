/**
 * Alert Service
 * Monitors APM metrics and generates alerts for anomalies
 */

const apmService = require('./apmService');

class AlertService {
  constructor() {
    this.alerts = [];
    this.config = {
      errorRateThreshold: 10, // % errors in 5 minutes
      avgResponseTimeThreshold: 3000, // ms
      memoryUsageThreshold: 80, // %
      fivexxErrorThreshold: 5 // count in 5 minutes
    };

    // Start alert check task (every 5 minutes) - skip in test env
    if (process.env.NODE_ENV !== 'test') {
      this.startAlertCheckTask();
    }
  }

  /**
   * Check for alert conditions
   */
  checkAlerts() {
    try {
      const health = apmService.getHealthCheck();
      const metrics = apmService.getMetrics();
      const now = Date.now();

      // Alert 1: High error rate in last 5 minutes
      if (health.requests && metrics.requests) {
        const errorRate = health.requests.errorRate5min || 0;
        if (errorRate > this.config.errorRateThreshold) {
          this.createAlert(
            'HIGH_ERROR_RATE',
            `Error rate ${errorRate}% exceeds threshold of ${this.config.errorRateThreshold}%`,
            'warning',
            { errorRate }
          );
        } else {
          this.dismissAlert('HIGH_ERROR_RATE');
        }
      }

      // Alert 2: High average response time
      if (metrics.requests && metrics.requests.avgResponseTime > this.config.avgResponseTimeThreshold) {
        this.createAlert(
          'SLOW_RESPONSE_TIME',
          `Average response time ${metrics.requests.avgResponseTime}ms exceeds threshold`,
          'warning',
          { avgResponseTime: metrics.requests.avgResponseTime }
        );
      } else {
        this.dismissAlert('SLOW_RESPONSE_TIME');
      }

      // Alert 3: High memory usage
      if (health.memory && health.memory.percentUsed > this.config.memoryUsageThreshold) {
        this.createAlert(
          'HIGH_MEMORY_USAGE',
          `Memory usage ${health.memory.percentUsed}% exceeds threshold of ${this.config.memoryUsageThreshold}%`,
          'error',
          {
            memoryUsed: health.memory.heapUsed,
            memoryTotal: health.memory.heapTotal,
            percentUsed: health.memory.percentUsed
          }
        );
      } else {
        this.dismissAlert('HIGH_MEMORY_USAGE');
      }

      // Alert 4: High number of 5xx errors
      const fivexxCount = (metrics.byStatusCode['500'] || 0) +
                          (metrics.byStatusCode['502'] || 0) +
                          (metrics.byStatusCode['503'] || 0) +
                          (metrics.byStatusCode['504'] || 0);

      if (fivexxCount > this.config.fivexxErrorThreshold) {
        this.createAlert(
          'SERVER_ERRORS',
          `${fivexxCount} server errors detected`,
          'error',
          { count: fivexxCount }
        );
      } else {
        this.dismissAlert('SERVER_ERRORS');
      }

    } catch (error) {
      console.error('[AlertService] Error checking alerts:', error.message);
    }
  }

  /**
   * Create or update an alert
   * @private
   */
  createAlert(alertId, message, severity = 'warning', data = {}) {
    try {
      const existingAlert = this.alerts.find(a => a.id === alertId);

      if (existingAlert) {
        // Update existing alert
        existingAlert.message = message;
        existingAlert.severity = severity;
        existingAlert.data = data;
        existingAlert.lastUpdated = new Date().toISOString();
        existingAlert.count = (existingAlert.count || 1) + 1;
      } else {
        // Create new alert
        this.alerts.push({
          id: alertId,
          message,
          severity,
          data,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          acknowledged: false,
          count: 1
        });

        // Log alert to console
        const logLevel = severity === 'error' ? console.error : console.warn;
        logLevel(`[ALERT] ${alertId}: ${message}`);
      }
    } catch (error) {
      console.error('[AlertService] Error creating alert:', error.message);
    }
  }

  /**
   * Dismiss an alert by ID
   * @private
   */
  dismissAlert(alertId) {
    try {
      const index = this.alerts.findIndex(a => a.id === alertId);
      if (index !== -1) {
        this.alerts.splice(index, 1);
      }
    } catch (error) {
      console.error('[AlertService] Error dismissing alert:', error.message);
    }
  }

  /**
   * Get all active alerts
   * @returns {Array} Array of active alerts
   */
  getActiveAlerts() {
    try {
      return this.alerts.map(alert => ({
        ...alert,
        isAcknowledged: alert.acknowledged
      }));
    } catch (error) {
      console.error('[AlertService] Error getting alerts:', error.message);
      return [];
    }
  }

  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID to acknowledge
   */
  acknowledgeAlert(alertId) {
    try {
      const alert = this.alerts.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date().toISOString();
        console.log(`[AlertService] Alert acknowledged: ${alertId}`);
      }
    } catch (error) {
      console.error('[AlertService] Error acknowledging alert:', error.message);
    }
  }

  /**
   * Start periodic alert check task
   * @private
   */
  startAlertCheckTask() {
    // Run immediately on startup
    this.checkAlerts();

    // Then run every 5 minutes
    setInterval(() => {
      this.checkAlerts();
    }, 300000); // 5 minutes
  }
}

// Export singleton instance
module.exports = new AlertService();
