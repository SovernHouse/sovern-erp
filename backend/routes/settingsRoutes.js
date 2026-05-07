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
 * In-memory store for settings
 * @todo In production, use a dedicated Settings model
 */
let companySettings = {
  companyName: 'Trading ERP',
  companyEmail: 'info@tradingerp.com',
  companyPhone: '+1-800-000-0000',
  companyAddress: '',
  companyCity: '',
  companyCountry: '',
  companyLogo: '',
  currency: 'USD',
  timezone: 'UTC',
  language: 'en',
  taxRate: 0,
  defaultPaymentTerms: 'Net 30'
};

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

// GET /company - Get company settings
router.get('/company', requireAuth, async (req, res, next) => {
  try {
    res.json(getSuccessResponse(companySettings, 'Company settings retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// PUT /company - Update company settings (admin only)
router.put('/company', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { companyName, companyEmail, companyPhone, companyAddress, companyCity, companyCountry, companyLogo, currency, timezone, language, taxRate, defaultPaymentTerms } = req.body;

    const previousSettings = { ...companySettings };

    if (companyName !== undefined) companySettings.companyName = companyName;
    if (companyEmail !== undefined) companySettings.companyEmail = companyEmail;
    if (companyPhone !== undefined) companySettings.companyPhone = companyPhone;
    if (companyAddress !== undefined) companySettings.companyAddress = companyAddress;
    if (companyCity !== undefined) companySettings.companyCity = companyCity;
    if (companyCountry !== undefined) companySettings.companyCountry = companyCountry;
    if (companyLogo !== undefined) companySettings.companyLogo = companyLogo;
    if (currency !== undefined) companySettings.currency = currency;
    if (timezone !== undefined) companySettings.timezone = timezone;
    if (language !== undefined) companySettings.language = language;
    if (taxRate !== undefined) companySettings.taxRate = parseFloat(taxRate);
    if (defaultPaymentTerms !== undefined) companySettings.defaultPaymentTerms = defaultPaymentTerms;

    res.json(getSuccessResponse(companySettings, 'Company settings updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'UPDATE',
      'CompanySettings',
      'company',
      { before: previousSettings, after: companySettings },
      req.ip
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
