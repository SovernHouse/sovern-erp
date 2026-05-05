/**
 * Monitoring Routes
 * Endpoints for viewing APM and system metrics
 */

const express = require('express');
const router = express.Router();
const apmService = require('../services/apmService');
const alertService = require('../services/alertService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSuccessResponse } = require('../utils/helpers');
const logger = require('../utils/logger.js');

/**
 * GET /api/monitoring/health
 * Public health check endpoint (no authentication required)
 */
router.get('/health', (req, res) => {
  try {
    const health = apmService.getHealthCheck();
    res.json(health);
  } catch (error) {
    logger.error('[Monitoring] Error getting health:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get health status',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Get request and performance metrics (admin only)
 */
router.get('/metrics', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const metrics = apmService.getMetrics();
    res.json(getSuccessResponse(metrics, 'Metrics retrieved successfully'));
  } catch (error) {
    logger.error('[Monitoring] Error getting metrics:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get metrics',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/errors
 * Get recent errors (admin only)
 * Query param: ?limit=50 (default: 50, max: 100)
 */
router.get('/errors', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const errors = apmService.getErrors(limit);

    res.json(getSuccessResponse(
      {
        total: errors.length,
        errors
      },
      'Errors retrieved successfully'
    ));
  } catch (error) {
    logger.error('[Monitoring] Error getting errors:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get errors',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/slow-requests
 * Get slow request log (admin only)
 * Query param: ?limit=20 (default: 20, max: 50)
 */
router.get('/slow-requests', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const slowRequests = apmService.getSlowRequests(limit);

    res.json(getSuccessResponse(
      {
        total: slowRequests.length,
        slowRequests
      },
      'Slow requests retrieved successfully'
    ));
  } catch (error) {
    logger.error('[Monitoring] Error getting slow requests:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get slow requests',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/system
 * Get system information (admin only)
 */
router.get('/system', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const health = apmService.getHealthCheck();
    const memUsage = process.memoryUsage();

    const systemInfo = {
      nodejs: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: Math.floor(process.uptime()),
      cpuUsage: process.cpuUsage(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        percentUsed: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      apm: health
    };

    res.json(getSuccessResponse(systemInfo, 'System info retrieved successfully'));
  } catch (error) {
    logger.error('[Monitoring] Error getting system info:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get system info',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get active alerts (admin only)
 */
router.get('/alerts', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const alerts = alertService.getActiveAlerts();

    res.json(getSuccessResponse(
      {
        total: alerts.length,
        alerts
      },
      'Alerts retrieved successfully'
    ));
  } catch (error) {
    logger.error('[Monitoring] Error getting alerts:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get alerts',
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring/alerts/:alertId/acknowledge
 * Acknowledge an alert (admin only)
 */
router.post('/alerts/:alertId/acknowledge', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { alertId } = req.params;

    alertService.acknowledgeAlert(alertId);

    res.json(getSuccessResponse(
      { alertId },
      'Alert acknowledged successfully'
    ));
  } catch (error) {
    logger.error('[Monitoring] Error acknowledging alert:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring/reset
 * Reset all metrics (admin only)
 * WARNING: This clears all collected metrics
 */
router.post('/reset', requireAuth, requireRole('admin'), (req, res) => {
  try {
    apmService.reset();

    res.json(getSuccessResponse(
      null,
      'All metrics reset successfully'
    ));
  } catch (error) {
    logger.error('[Monitoring] Er