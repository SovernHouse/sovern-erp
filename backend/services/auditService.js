const db = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger.js');

/**
 * Core audit logging service
 * Handles creating audit log entries and querying audit history
 */

/**
 * Log an action (CREATE, UPDATE, DELETE) to the audit trail
 * This is fire-and-forget - errors are logged but don't break the request
 *
 * @param {string} userId - UUID of the user performing the action (can be null)
 * @param {string} action - Action type (CREATE, UPDATE, DELETE)
 * @param {string} entity - Entity type (e.g., 'SalesOrder', 'Customer')
 * @param {string} entityId - UUID of the affected entity
 * @param {object} changes - Change details (can include before/after for updates)
 * @param {string} ipAddress - IP address of the request
 * @returns {Promise<void>}
 */
async function logAction(userId, action, entity, entityId, changes, ipAddress) {
  try {
    await db.AuditLog.create({
      userId: userId || null,
      action,
      entity,
      entityId,
      changes: changes || {},
      ipAddress: ipAddress || null,
      timestamp: new Date()
    });
  } catch (error) {
    // Log failures should not break the request - just log and continue
    logger.error(`[AuditLog Error] Failed to log ${action} for ${entity}:`, error.message);
  }
}

/**
 * Get audit trail for a specific entity
 * Shows all changes made to a particular record
 *
 * @param {string} entityType - Entity type (e.g., 'SalesOrder')
 * @param {string} entityId - UUID of the entity
 * @param {object} options - Query options (limit, offset, order)
 * @returns {Promise<object>} - { total, logs, entity, entityId }
 */
async function getAuditTrail(entityType, entityId, options = {}) {
  const { limit = 50, offset = 0, order = 'DESC' } = options;

  try {
    const { count, rows } = await db.AuditLog.findAndCountAll({
      where: {
        entity: entityType,
        entityId: entityId
      },
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['timestamp', order]],
      raw: false
    });

    return {
      total: count,
      logs: rows,
      entity: entityType,
      entityId: entityId
    };
  } catch (error) {
    logger.error(`[AuditLog Error] Failed to retrieve audit trail for ${entityType}:${entityId}:`, error.message);
    throw error;
  }
}

/**
 * Get all activity for a specific user
 * Useful for tracking what a user has done in the system
 *
 * @param {string} userId - UUID of the user
 * @param {object} options - Query options (limit, offset, order)
 * @returns {Promise<object>} - { total, activities, userId }
 */
async function getUserActivity(userId, options = {}) {
  const { limit = 50, offset = 0, order = 'DESC' } = options;

  try {
    const { count, rows } = await db.AuditLog.findAndCountAll({
      where: {
        userId: userId
      },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['timestamp', order]],
      raw: false
    });

    return {
      total: count,
      activities: rows,
      userId: userId
    };
  } catch (error) {
    logger.error(`[AuditLog Error] Failed to retrieve user activity for ${userId}:`, error.message);
    throw error;
  }
}

/**
 * Get recent activity across the entire system
 * Useful for dashboards and activity feeds
 *
 * @param {object} options - Query options (limit, offset, order, action, entity)
 * @returns {Promise<object>} - { total, activities }
 */
async function getRecentActivity(options = {}) {
  const {
    limit = 50,
    offset = 0,
    order = 'DESC',
    action = null,
    entity = null,
    hoursBack = 24 // Get last 24 hours by default
  } = options;

  try {
    const where = {};

    // Optional filters
    if (action) where.action = action;
    if (entity) where.entity = entity;

    // Time range filter
    if (hoursBack) {
      const timeThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      where.timestamp = { [Op.gte]: timeThreshold };
    }

    const { count, rows } = await db.AuditLog.findAndCountAll({
      where,
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['timestamp', order]],
      raw: false
    });

    return {
      total: count,
      activities: rows
    };
  } catch (error) {
    logger.error(`[AuditLog Error] Failed to retrieve recent activity:`, error.message);
    throw error;
  }
}

/**
 * Get audit statistics for a given time period
 * Useful for compliance and reporting
 *
 * @param {object} options - Query options (startDate, endDate, groupBy)
 * @returns {Promise<object>} - { stats }
 */
async function getAuditStats(options = {}) {
  const {
    startDate = null,
    endDate = null,
    groupBy = 'action' // 'action', 'entity', 'user'
  } = options;

  try {
    const where = {};

    if (startDate && endDate) {
      where.timestamp = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const logs = await db.AuditLog.findAll({
      where,
      attributes: [groupBy, [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: [groupBy],
      raw: true
    });

    return {
      stats: logs,
      groupedBy: groupBy
    };
  } catch (error) {
    logger.error(`[AuditLog Error] Failed to retrieve audit stats:`, error.message);
    throw error;
  }
}

/**
 * Delete old audit logs (for cleanup/archival)
 * Only keeps logs within the specified number of days
 *
 * @param {number} daysToKeep - Number of days to keep logs
 * @returns {Promise<number>} - Number of deleted records
 */
async function deleteOldLogs(daysToKeep = 90) {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const deletedCount = await db.AuditLog.destroy({
      where: {
        timestamp: { [Op.lt]: cutoffDate }
      }
    });

    logger.info(`[AuditLog] Deleted ${deletedCount} old audit logs older than ${daysToKeep} days`);
    return deletedCount;
  } catch (error) {
    logger.error(`[AuditLog Error] Failed to delete old logs:`, error.message);
    throw error;
  }
}

/**
 * Export audit logs as CSV
 *
 * @param {object} options - Query options (startDate, endDate, action, entity)
 * @returns {Promise<string>} - CSV content
 */
async function exportAuditLogsAsCSV(options = {}) {
  try {
    const {
      startDate = null,
      endDate = null,
      action = null,
      entity = null
    } = options;

    const where = {};

    if (action) where.action = action;
    if (entity) where.entity = entity;

    if (startDate && endDate) {
      where.timestamp = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const logs = await db.AuditLog.findAll({
      where,
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName']
        }
      ],
      order: [['timestamp', 'DESC']],
      raw: false
    });

    // Build CSV header
    const headers = ['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Changes', 'IP Address'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.user ? `${log.user.firstName} ${log.user.lastName} (${log.user.email})` : 'System',
      log.action,
      log.entity,
      log.entityId,
      JSON.stringify(log.changes),
      log.ipAddress || 'N/A'
    ]);

    // Escape CSV values
    const escapedRows = rows.map(row =>
      row.map(cell => {
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    );

    const csv = [
      headers.join(','),
      ...escapedRows
    ].join('\n');

    return csv;
  } catch (error) {
    logger.error(`[AuditLog Error] Failed to export audit logs as CSV:`, error.message);
    throw error;
  }
}

module.exports = {
  logAction,
  getAuditTrail,
  getUserActivity,
  getRecentActivity,
  getAuditStats,
  deleteOldLogs,
  exportAuditLogsAsCSV
};
