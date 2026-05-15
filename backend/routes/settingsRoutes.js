/**
 * Settings Management Routes
 * @module routes/settingsRoutes
 * @description Endpoints for managing system and company settings
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 * @requires ../services/auditService
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

/**
 * Phase 4.8, Commit 1 — company settings now persist to db.SystemSetting.
 *
 * Previously this file held a module-scoped `let companySettings` literal
 * (line 23 of the pre-fix version). Mutations from PUT /company lasted only
 * until the next backend boot; on restart the literal re-initialised to the
 * hardcoded "Trading ERP" defaults and wiped every user edit. This was the
 * root cause of Alex's "Settings General does not persist" bug.
 *
 * Singleton helper. Reads the single SystemSetting row; creates it on first
 * call with the model-level defaults (which match the legacy in-memory
 * shape: companyName='Trading ERP', currency='USD', taxRate=0, etc., but
 * timezone='Asia/Taipei' per L-042). Seed-only-if-empty: subsequent boots
 * find the existing row and never overwrite values Alex has saved.
 *
 * Field whitelist for PUT below intentionally omits id, key, createdAt,
 * updatedAt so the route can `update(req.body)` without sanitising.
 */
const COMPANY_WRITABLE_FIELDS = [
  'companyName', 'companyEmail', 'companyPhone',
  'companyAddress', 'companyCity', 'companyCountry', 'companyLogo',
  'currency', 'timezone', 'language', 'taxRate', 'defaultPaymentTerms',
];

async function getOrCreateCompanySettings() {
  if (!db.SystemSetting) {
    throw new Error('SystemSetting model not registered');
  }
  const [row] = await db.SystemSetting.findOrCreate({
    where: { key: 'company' },
    defaults: { key: 'company' },
  });
  return row;
}

let emailTemplates = [
  {
    id: '1',
    name: 'Order Confirmation',
    subject: 'Your Order #{orderId} has been confirmed',
    body: 'Thank you for your order. We will process it shortly.',
    category: 'orders',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: 'Shipment Notification',
    subject: 'Your shipment #{shipmentId} is on the way',
    body: 'Your order has been shipped. Tracking number: {trackingNumber}',
    category: 'shipments',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    name: 'Invoice Notification',
    subject: 'Invoice #{invoiceId} is ready',
    body: 'Your invoice is attached. Please review and process payment accordingly.',
    category: 'invoices',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// GET /company — fetch the singleton SystemSetting row (creates it with
// model defaults on first call after the table is provisioned).
router.get('/company', requireAuth, async (req, res, next) => {
  try {
    const row = await getOrCreateCompanySettings();
    res.json(getSuccessResponse(row.toJSON(), 'Company settings retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// PUT /company — persist edits to the SystemSetting row. admin role (NOT
// super_admin) to match the existing surface; tightening to super_admin is
// a Phase 5 conversation. Pre-edit snapshot is captured for the AuditLog
// trail.
router.put('/company', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const row = await getOrCreateCompanySettings();
    const before = row.toJSON();

    // Apply only whitelisted fields. Coerce taxRate to number; the rest are
    // strings already. Undefined fields stay untouched so PATCH semantics
    // work even on a PUT-shaped client.
    const updates = {};
    for (const k of COMPANY_WRITABLE_FIELDS) {
      if (req.body[k] !== undefined) {
        updates[k] = k === 'taxRate' ? parseFloat(req.body[k]) : req.body[k];
      }
    }
    await row.update(updates);
    const after = row.toJSON();

    res.json(getSuccessResponse(after, 'Company settings updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'UPDATE',
      'CompanySettings',
      'company',
      { before, after, updatedFields: Object.keys(updates) },
      req.ip,
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /email-templates - List email templates
router.get('/email-templates', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    const slicedTemplates = emailTemplates.slice(offset, offset + parseInt(limit));
    const count = emailTemplates.length;

    res.json(getPaginatedResponse(slicedTemplates, count, page, limit));
  } catch (error) {
    next(error);
  }
});

// PUT /email-templates/:id - Update email template (admin only)
router.put('/email-templates/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { subject, body, isActive } = req.body;

    const template = emailTemplates.find(t => t.id === req.params.id);
    if (!template) {
      throw new NotFoundError('Email template not found');
    }

    const previousData = { ...template };

    if (subject !== undefined) template.subject = subject;
    if (body !== undefined) template.body = body;
    if (isActive !== undefined) template.isActive = isActive;
    template.updatedAt = new Date();

    res.json(getSuccessResponse(template, 'Email template updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'UPDATE',
      'EmailTemplate',
      template.id,
      { before: previousData, after: template },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /logs - Get system/audit logs with pagination (admin only)
router.get('/logs', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 10, action, entity, userId } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const { count, rows } = await db.AuditLog.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      include: [
        {
          model: db.User,
          attributes: ['id', 'email', 'firstName', 'lastName'],
          required: false
        }
      ],
      order: [['timestamp', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
});

// ─── Frontend Error Reporting ────────────────────────────────────────────────

// POST /frontend-errors — report a client-side crash (auth optional)
// Uses raw token extraction so a 401 never blocks the report from being saved.
router.post('/frontend-errors', async (req, res) => {
  try {
    const { errorMessage, errorStack, componentStack, pageUrl, userAgent, metadata } = req.body;
    if (!errorMessage) return res.status(400).json({ success: false, message: 'errorMessage required' });

    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const authConfig = require('../config/auth');
        const decoded = jwt.verify(authHeader.slice(7), authConfig.jwt.secret);
        userId = decoded.id || null;
      } catch { /* token expired or invalid — log anonymously */ }
    }

    await db.FrontendError.create({
      userId,
      errorMessage: String(errorMessage).slice(0, 1000),
      errorStack: errorStack ? String(errorStack).slice(0, 10000) : null,
      componentStack: componentStack ? String(componentStack).slice(0, 10000) : null,
      pageUrl: pageUrl ? String(pageUrl).slice(0, 2000) : null,
      userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      metadata: metadata || {},
    });

    res.json({ success: true });
  } catch (error) {
    // Never let logging fail noisily — always return 200 to the client
    console.error('[FrontendError] Failed to save:', error.message);
    res.json({ success: false });
  }
});

// GET /frontend-errors — list crashes for admin review
router.get('/frontend-errors', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { offset } = getPagination(page, limit);

    const { count, rows } = await db.FrontendError.findAndCountAll({
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [{
        model: db.User,
        as: 'user',
        attributes: ['id', 'email', 'firstName', 'lastName'],
        required: false,
      }],
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
});

// DELETE /frontend-errors — clear all crash logs (admin only)
router.delete('/frontend-errors', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    await db.FrontendError.destroy({ where: {}, truncate: true });
    res.json({ success: true, message: 'Frontend error log cleared.' });
  } catch (error) {
    next(error);
  }
});

// ─── Role Permissions ────────────────────────────────────────────────────────
const rolePermissionController = require('../controllers/rolePermissionController');

router.get('/role-permissions', requireAuth, rolePermissionController.getRolePermissions);
router.post('/role-permissions', requireAuth, requireRole('admin'), rolePermissionController.createRolePermission);
router.put('/role-permissions/:role', requireAuth, requireRole('admin'), rolePermissionController.updateRolePermissions);
router.delete('/role-permissions/:role', requireAuth, requireRole('admin'), rolePermissionController.deleteRolePermission);
router.post('/role-permissions/:role/reset', requireAuth, requireRole('admin'), rolePermissionController.resetRolePermissions);

module.exports = router;
