const express = require('express');
const router = express.Router();
const db = require('../models');
const fs = require('fs');
const path = require('path');

let requestCount = 0;
const startTime = Date.now();

/**
 * GET /health
 * Basic health check - returns 200 OK
 */
router.get('/', async (req, res, next) => {
  try {
    requestCount++;
    res.status(200).json({
      success: true,
      status: 'OK',
      message: 'Service is healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /health/detailed
 * Detailed health check with system metrics
 */
router.get('/detailed', async (req, res, next) => {
  try {
    requestCount++;

    // Check database connection
    let dbStatus = 'disconnected';
    let dbError = null;
    try {
      await db.sequelize.authenticate();
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'error';
      dbError = error.message;
    }

    // Get uptime in seconds
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    // Get memory usage
    const memoryUsage = process.memoryUsage();

    // Get Node.js version
    const nodeVersion = process.version;

    // Get app version from package.json
    let appVersion = 'unknown';
    try {
      const packageJsonPath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      appVersion = packageJson.version || 'unknown';
    } catch (error) {
      appVersion = 'unknown';
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptime,
        readable: formatUptime(uptime)
      },
      database: {
        status: dbStatus,
        error: dbError
      },
      memory: {
        rss: formatBytes(memoryUsage.rss),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        heapUsed: formatBytes(memoryUsage.heapUsed),
        external: formatBytes(memoryUsage.external),
        arrayBuffers: formatBytes(memoryUsage.arrayBuffers)
      },
      system: {
        nodeVersion,
        appVersion,
        platform: process.platform,
        arch: process.arch,
        cpuCount: require('os').cpus().length
      },
      requests: {
        totalSinceStart: requestCount
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Helper function to format uptime in human-readable format
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Helper function to format bytes to human-readable format
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

module.exports = router;
