/**
 * approvalRoutes.js
 *
 * Handles online document approval (e-signature / confirm order).
 *
 * Authenticated endpoints (require JWT):
 *   POST /api/approvals/generate   — create an approval link for a document
 *   GET  /api/approvals            — list all approvals (paginated, filtered)
 *   GET  /api/approvals/:id        — get one approval record by internal ID
 *
 * Public endpoints (NO auth — clients access these via a shared link):
 *   GET  /api/approvals/public/:token   — get document summary for approval page
 *   POST /api/approvals/public/:token/approve  — client approves
 *   POST /api/approvals/public/:token/reject   — client rejects
 *
 * NOTE: The public routes are intentionally unauthenticated because clients
 * receive only the token link (no ERP credentials). The token is a 64-char
 * hex secret (256 bits of entropy) and expires after APPROVAL_LINK_EXPIRY_DAYS
 * (default 30 days).
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../models');
const dayjs = require('dayjs');
const { requireAuth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { getSuccessResponse, getPagination, getPaginatedResponse } = require('../utils/helpers');
const emailService = require('../services/emailService');

const publicApprovalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
});

const EXPIRY_DAYS = parseInt(process.env.APPROVAL_LINK_EXPIRY_DAYS || '30', 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a document to a lightweight summary safe to expose publicly.
 * Returns null if the entity type is unsupported or the record doesn't exist.
 */
async function resolveDocument(entityType, entityId) {
  switch (entityType) {
    case 'ProformaInvoice': {
      const pi = await db.ProformaInvoice.findByPk(entityId, {
        include: [
          { model: db.Customer, as: 'customer', attributes: ['companyName', 'email', 'country'] },
          { association: 'items', include: [{ model: db.Product, as: 'product', attributes: ['name'] }] },
        ],
      });
      if (!pi) return null;
      return {
        type: 'Proforma Invoice',
        number: pi.piNumber || pi.invoiceNumber || pi.proformaNumber || `PI-${entityId.slice(0, 8)}`,
        customer: pi.customer?.companyName,
        currency: pi.currency || 'USD',
        total: pi.total,
        items: (pi.items || []).map(i => ({
          description: i.product?.name || i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
        paymentTerms: pi.paymentTerms,
        validUntil: pi.validUntil,
      };
    }

    case 'Quotation': {
      const q = await db.Quotation.findByPk(entityId, {
        include: [
          { model: db.Customer, as: 'customer', attributes: ['companyName', 'email', 'country'] },
          { association: 'lineItems', include: [{ model: db.Product, as: 'product', attributes: ['name'] }] },
        ],
      });
      if (!q) return null;
      return {
        type: 'Quotation',
        number: q.quotationNumber || `QT-${entityId.slice(0, 8)}`,
        customer: q.customer?.companyName,
        currency: q.currency || 'USD',
        total: q.total,
        items: (q.lineItems || []).map(i => ({
          description: i.product?.name || i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
        paymentTerms: q.paymentTerms,
        validUntil: q.validUntil,
      };
    }

    case 'SalesOrder': {
      const so = await db.SalesOrder.findByPk(entityId, {
        include: [
          { model: db.Customer, as: 'customer', attributes: ['companyName', 'email', 'country'] },
          { association: 'items', include: [{ model: db.Product, as: 'product', attributes: ['name'] }] },
        ],
      });
      if (!so) return null;
      return {
        type: 'Sales Order',
        number: so.orderNumber || `SO-${entityId.slice(0, 8)}`,
        customer: so.customer?.companyName,
        currency: so.currency || 'USD',
        total: so.total,
        items: (so.items || []).map(i => ({
          description: i.product?.name || i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
        estimatedDelivery: so.estimatedDelivery,
      };
    }

    default:
      return null;
  }
}

// ─── Authenticated routes ─────────────────────────────────────────────────────

/**
 * POST /api/approvals/generate
 * Create a new approval link for a document.
 * Body: { entityType, entityId, notes?, clientEmail?, expiryDays? }
 */
router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const { entityType, entityId, notes, clientEmail, expiryDays } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({ success: false, message: 'entityType and entityId are required' });
    }

    const supportedTypes = ['ProformaInvoice', 'Quotation', 'SalesOrder'];
    if (!supportedTypes.includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: `entityType must be one of: ${supportedTypes.join(', ')}`,
      });
    }

    // Verify the document exists and get its label
    const doc = await resolveDocument(entityType, entityId);
    if (!doc) {
      return res.status(404).json({ success: false, message: `${entityType} not found` });
    }

    const expiresAt = dayjs().add(expiryDays || EXPIRY_DAYS, 'day').toDate();
    const approval = await db.DocumentApproval.create({
      id: uuidv4(),
      entityType,
      entityId,
      documentLabel: doc.number,
      expiresAt,
      requestedByUserId: req.user?.id || null,
      notes: notes || null,
    });

    // Build the public approval URL
    const baseUrl = process.env.CLIENT_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const approvalUrl = `${baseUrl}/approve/${approval.token}`;

    res.status(201).json(getSuccessResponse({
      id: approval.id,
      token: approval.token,
      approvalUrl,
      expiresAt: approval.expiresAt,
      documentLabel: doc.number,
    }, 'Approval link generated'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/approvals/pending
 * Returns all pending DocumentApprovals with document number, customer, and value.
 * Used by the Sovern Ops mobile app Approvals tab.
 * MUST be registered before /:id to avoid 'pending' being treated as an ID.
 */
router.get('/pending', requireAuth, async (req, res, next) => {
  try {
    const approvals = await db.DocumentApproval.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'DESC']],
    });

    // Enrich each approval with customer name and total from the referenced document
    const data = await Promise.all(
      approvals.map(async (a) => {
        let customerName  = '';
        let totalValueUSD = 0;

        try {
          if (a.entityType === 'ProformaInvoice' && db.ProformaInvoice) {
            const doc = await db.ProformaInvoice.findByPk(a.entityId, {
              include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }],
            });
            customerName  = doc?.customer?.companyName || '';
            totalValueUSD = doc?.total || 0;
          } else if (a.entityType === 'Quotation' && db.Quotation) {
            const doc = await db.Quotation.findByPk(a.entityId, {
              include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }],
            });
            customerName  = doc?.customer?.companyName || '';
            totalValueUSD = doc?.total || 0;
          } else if (a.entityType === 'SalesOrder' && db.SalesOrder) {
            const doc = await db.SalesOrder.findByPk(a.entityId, {
              include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }],
            });
            customerName  = doc?.customer?.companyName || '';
            totalValueUSD = doc?.total || 0;
          }
        } catch { /* lookup failure — return partial data */ }

        return {
          id:            a.id,
          documentType:  a.entityType === 'ProformaInvoice' ? 'PI' : a.entityType,
          documentNumber:a.documentLabel || a.entityId,
          customerName,
          totalValueUSD,
          createdAt:     a.createdAt,
          status:        a.status,
        };
      })
    );

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/approvals
 * List approvals with optional filters.
 * Query params: entityType, entityId, status, page, limit
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, entityType, entityId, status } = req.query;
    const { offset } = getPagination(page, limit);
    const where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (status) where.status = status;

    const { count, rows } = await db.DocumentApproval.findAndCountAll({
      where,
      include: [{ model: db.User, as: 'requestedBy', attributes: ['firstName', 'lastName', 'email'] }],
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/approvals/:id
 * Get one approval record by internal UUID.
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const approval = await db.DocumentApproval.findByPk(req.params.id, {
      include: [{ model: db.User, as: 'requestedBy', attributes: ['firstName', 'lastName', 'email'] }],
    });
    if (!approval) return res.status(404).json({ success: false, message: 'Approval not found' });
    res.json(getSuccessResponse(approval));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/approvals/:id/approve
 * Authenticated — manager/internal override approval.
 * Used by Sovern Ops mobile app when a manager confirms a document internally.
 */
router.post('/:id/approve', requireAuth, async (req, res, next) => {
  try {
    const approval = await db.DocumentApproval.findByPk(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Approval not found' });

    if (approval.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `This document has already been ${approval.status}`,
      });
    }

    const { comment } = req.body;
    await approval.update({
      status: 'approved',
      clientName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Manager',
      respondedAt: new Date(),
      notes: comment ? `[Internal] ${comment}` : approval.notes,
    });

    res.json(getSuccessResponse({ status: 'approved' }, 'Document approved'));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/approvals/:id/flag
 * Authenticated — manager flags a document for revision before sending to client.
 * Body: { comment: string (required) }
 */
router.post('/:id/flag', requireAuth, async (req, res, next) => {
  try {
    const approval = await db.DocumentApproval.findByPk(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Approval not found' });

    if (approval.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `This document has already been ${approval.status}`,
      });
    }

    const { comment } = req.body;
    if (!comment?.trim()) {
      return res.status(400).json({ success: false, message: 'A comment is required when flagging a document' });
    }

    await approval.update({
      status: 'rejected',
      rejectionReason: comment.trim(),
      respondedAt: new Date(),
    });

    res.json(getSuccessResponse({ status: 'flagged' }, 'Document flagged for revision'));
  } catch (error) {
    next(error);
  }
});

// ─── Public token-based routes ────────────────────────────────────────────────

/**
 * GET /api/approvals/public/:token
 * Public endpoint — no auth required.
 * Returns document summary for the client approval page.
 */
router.get('/public/:token', publicApprovalLimiter, async (req, res, next) => {
  try {
    const approval = await db.DocumentApproval.findOne({
      where: { token: req.params.token },
    });

    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval link not found' });
    }

    if (approval.status === 'expired' || dayjs().isAfter(approval.expiresAt)) {
      await approval.update({ status: 'expired' });
      return res.status(410).json({ success: false, message: 'This approval link has expired' });
    }

    const doc = await resolveDocument(approval.entityType, approval.entityId);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document no longer exists' });
    }

    res.json(getSuccessResponse({
      approvalId: approval.id,
      status: approval.status,
      documentLabel: approval.documentLabel,
      expiresAt: approval.expiresAt,
      notes: approval.notes,
      document: doc,
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/approvals/public/:token/approve
 * Public endpoint — client approves the document.
 * Body: { clientName, clientEmail? }
 */
router.post('/public/:token/approve', publicApprovalLimiter, async (req, res, next) => {
  try {
    const approval = await db.DocumentApproval.findOne({
      where: { token: req.params.token },
    });

    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval link not found' });
    }

    if (dayjs().isAfter(approval.expiresAt)) {
      await approval.update({ status: 'expired' });
      return res.status(410).json({ success: false, message: 'This approval link has expired' });
    }

    if (approval.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `This document has already been ${approval.status}`,
      });
    }

    const { clientName, clientEmail } = req.body;

    await approval.update({
      status: 'approved',
      clientName: clientName || null,
      clientEmail: clientEmail || null,
      respondedAt: new Date(),
      clientIp: req.ip || req.connection?.remoteAddress || null,
      clientUserAgent: req.headers['user-agent'] || null,
    });

    // Fire-and-forget notification to the internal user who created the link
    if (approval.requestedByUserId) {
      const notificationService = require('../services/notificationService');
      notificationService.createNotification({
        userId: approval.requestedByUserId,
        type: 'document_approved',
        title: 'Document Approved',
        message: `${approval.documentLabel} was approved by ${clientName || clientEmail || 'the client'}.`,
        entityType: approval.entityType,
        entityId: approval.entityId,
      }).catch(() => {});
    }

    res.json(getSuccessResponse({ status: 'approved' }, 'Document approved successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/approvals/public/:token/reject
 * Public endpoint — client rejects the document.
 * Body: { clientName, clientEmail?, rejectionReason? }
 */
router.post('/public/:token/reject', publicApprovalLimiter, async (req, res, next) => {
  try {
    const approval = await db.DocumentApproval.findOne({
      where: { token: req.params.token },
    });

    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval link not found' });
    }

    if (dayjs().isAfter(approval.expiresAt)) {
      await approval.update({ status: 'expired' });
      return res.status(410).json({ success: false, message: 'This approval link has expired' });
    }

    if (approval.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `This document has already been ${approval.status}`,
      });
    }

    const { clientName, clientEmail, rejectionReason } = req.body;

    await approval.update({
      status: 'rejected',
      clientName: clientName || null,
      clientEmail: clientEmail || null,
      rejectionReason: rejectionReason || null,
      respondedAt: new Date(),
      clientIp: req.ip || req.connection?.remoteAddress || null,
      clientUserAgent: req.headers['user-agent'] || null,
    });

    // Fire-and-forget notification
    if (approval.requestedByUserId) {
      const notificationService = require('../services/notificationService');
      notificationService.createNotification({
        userId: approval.requestedByUserId,
        type: 'document_rejected',
        title: 'Document Rejected',
        message: `${approval.documentLabel} was rejected by ${clientName || clientEmail || 'the client'}${rejectionReason ? ': ' + rejectionReason : ''}.`,
        entityType: approval.entityType,
        entityId: approval.entityId,
      }).catch(() => {});
    }

    res.json(getSuccessResponse({ status: 'rejected' }, 'Document rejected'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
