const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const { requireAuth } = require('../middleware/auth');
const { getSuccessResponse, getPagination, getPaginatedResponse } = require('../utils/helpers');
const { NotFoundError } = require('../middleware/errorHandler');

/**
 * Audit Log Routes
 * Provides endpoints to view audit trails, user activity, and recent changes
 */

/**
 * GET /api/audit-logs
 * List all audit logs (admin only, paginated)
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    // In production, check for admin role here
    // if (req.user.role !== 'admin') throw new ForbiddenError('Admin access required');

    const { page = 1, limit = 20, action = null, entity = null, hoursBack = 24 } = req.query;
    const { offset } = getPagination(page, limit);

    const result = await auditService.getRecentActivity({
      action: action || null,
      entity: entity || null,
      hoursBack: hoursBack ? parseInt(hoursBack) : null,
      limit: parseInt(limit),
      offset: offset
    });

    res.json(getPaginatedResponse(
      result.activities,
      result.total,
      parseInt(page),
      parseInt(limit)
    ));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/entity/:entityType/:entityId
 * Get audit trail for a specific entity (all changes to one record)
 */
router.get('/entity/:entityType/:entityId', requireAuth, async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const { offset } = getPagination(page, limit);

    const result = await auditService.getAuditTrail(entityType, entityId, {
      limit: parseInt(limit),
      offset: offset
    });

    res.json(getPaginatedResponse(
      result.logs,
      result.total,
      parseInt(page),
      parseInt(limit)
    ));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/user/:userId
 * Get activity for a specific user
 */
router.get('/user/:userId', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const { offset } = getPagination(page, limit);

    const result = await auditService.getUserActivity(userId, {
      limit: parseInt(limit),
      offset: offset
    });

    res.json(getPaginatedResponse(
      result.activities,
      result.total,
      parseInt(page),
      parseInt(limit)
    ));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/recent
 * Get recent activity across the system (for dashboard)
 */
router.get('/recent', requireAuth, async (req, res, next) => {
  try {
    const { limit = 20, hoursBack = 24 } = req.query;

    const result = await auditService.getRecentActivity({
      limit: parseInt(limit),
      hoursBack: hoursBack ? parseInt(hoursBack) : 24
    });

    res.json(getSuccessResponse(
      result.activities,
      'Recent activity retrieved'
    ));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/stats
 * Get audit statistics (admin only)
 */
router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    // In production, check for admin role here
    // if (req.user.role !== 'admin') throw new ForbiddenError('Admin access required');

    const { startDate, endDate, groupBy = 'action' } = req.query;

    const result = await auditService.getAuditStats({
      startDate,
      endDate,
      groupBy
    });

    res.json(getSuccessResponse(result.stats, 'Audit statistics retrieved'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/export
 * Export audit logs as CSV
 */
router.get('/export', requireAuth, async (req, res, next) => {
  try {
    const { startDate, endDate, action, entity } = req.query;

    const csv = await auditService.exportAuditLogsAsCSV({
      startDate,
      endDate,
      action,
      entity
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/audit-logs/offline-replay
 * Phase 5h: a client posts the outcomes of its offline write-queue
 * replay so cross-device replay history is visible in the audit trail.
 * Caller logs ONE row per write-queue entry it processed (success or
 * fail). Body: { entries: [{ status, method, path, attempts,
 * clientUuid, lastError?, responseStatus?, createdAt, replayedAt? }] }
 *
 * Each entry becomes an AuditLog row with action='offline_replay_{status}'.
 * Cheap (sub-ms per write) and bounded: a typical batch is <10 entries.
 */
router.post('/offline-replay', requireAuth, async (req, res, next) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (entries.length === 0) {
      return res.json(getSuccessResponse({ written: 0 }, 'No entries'));
    }
    if (entries.length > 100) {
      const err = new Error('Too many entries in a single batch (max 100)');
      err.statusCode = 400;
      throw err;
    }
    let written = 0;
    for (const e of entries) {
      const status = String(e?.status || 'unknown').toLowerCase();
      const action = `offline_replay_${status}`;
      try {
        await auditService.logAction(
          req.user.id,
          action,
          'OfflineQueue',
          null,
          {
            method: e.method,
            path: e.path || e.url,
            attempts: e.attempts,
            clientUuid: e.clientUuid,
            createdAt: e.createdAt,
            replayedAt: e.replayedAt,
            responseStatus: e.responseStatus,
            lastError: e.lastError,
          },
          req.ip,
        );
        written++;
      } catch (_) { /* per-row failure doesn't abort the batch */ }
    }
    res.json(getSuccessResponse({ written, total: entries.length }, 'Offline replay logged'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
