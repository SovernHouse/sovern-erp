const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const webhookService = require('../services/webhookService');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, priority, customerId } = req.query;
    const { offset } = getPagination(page, limit);
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (customerId) where.customerId = customerId;

    const { count, rows } = await db.Claim.findAndCountAll({
      where,
      include: [
        { model: db.Customer, as: 'customer', attributes: ['companyName'] },
        { model: db.SalesOrder, as: 'salesOrder', attributes: ['orderNumber'] }
      ],
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const claim = await db.Claim.findByPk(req.params.id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.SalesOrder, as: 'salesOrder' }
      ]
    });

    if (!claim) throw new NotFoundError('Claim not found');
    res.json(getSuccessResponse(claim));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { salesOrderId, customerId, type, priority, description, images } = req.body;

    const so = await db.SalesOrder.findByPk(salesOrderId);
    const customer = await db.Customer.findByPk(customerId);

    if (!so || !customer) throw new NotFoundError('Sales Order or Customer not found');

    const claim = await db.Claim.create({
      id: uuidv4(),
      claimNumber: `CLM-${Date.now()}`,
      salesOrderId,
      customerId,
      type,
      priority: priority || 'medium',
      description,
      status: 'submitted',
      images: images || [],
      submittedAt: new Date()
    });

    res.status(201).json(getSuccessResponse(claim, 'Claim submitted'));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    const claim = await db.Claim.findByPk(req.params.id);

    if (!claim) throw new NotFoundError('Claim not found');

    await claim.update({ status });
    res.json(getSuccessResponse(claim, 'Claim status updated'));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/resolve', requireAuth, async (req, res, next) => {
  try {
    const { resolution, compensationType, compensationAmount } = req.body;
    const claim = await db.Claim.findByPk(req.params.id);

    if (!claim) throw new NotFoundError('Claim not found');

    await claim.update({
      status: 'resolved',
      resolution,
      compensationType,
      compensationAmount,
      resolvedAt: new Date()
    });

    res.json(getSuccessResponse(claim, 'Claim resolved'));
  } catch (error) {
    next(error);
  }
});

router.get('/customer/:customerId', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    const { count, rows } = await db.Claim.findAndCountAll({
      where: { customerId: req.params.customerId },
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /:id/investigate
 * Move claim to investigation status
 */
router.patch('/:id/investigate', requireAuth, async (req, res, next) => {
  try {
    const { investigationNotes } = req.body;

    const claim = await db.Claim.findByPk(req.params.id);
    if (!claim) throw new NotFoundError('Claim not found');

    const beforeSnapshot = claim.toJSON();

    await claim.update({
      status: 'investigating',
      resolution: investigationNotes || claim.resolution
    });

    const updatedClaim = await db.Claim.findByPk(claim.id);
    res.json(getSuccessResponse(updatedClaim, 'Claim moved to investigation'));

    // Fire-and-forget operations
    auditService.logAction(req.user.id, 'UPDATE', 'Claim', claim.id, { before: beforeSnapshot, after: updatedClaim?.toJSON?.() || claim.toJSON() }, req.ip).catch(() => {});
    webhookService.triggerWebhook('claim.investigating', {
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      status: 'investigating',
      updatedAt: new Date()
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /:id/resolve
 * Resolve claim with resolution type (refund/replacement/credit)
 */
router.patch('/:id/resolve', requireAuth, async (req, res, next) => {
  try {
    const { resolution, compensationType, compensationAmount } = req.body;

    if (!resolution) {
      throw new ValidationError('resolution description is required');
    }

    if (!compensationType || !['replacement', 'refund', 'credit', 'repair'].includes(compensationType)) {
      throw new ValidationError('Valid compensationType required: replacement, refund, credit, or repair');
    }

    const claim = await db.Claim.findByPk(req.params.id, {
      include: [{ model: db.Customer, as: 'customer' }]
    });
    if (!claim) throw new NotFoundError('Claim not found');

    const beforeSnapshot = claim.toJSON();

    await claim.update({
      status: 'resolved',
      resolution,
      compensationType,
      compensationAmount: compensationAmount || null,
      resolvedAt: new Date()
    });

    const updatedClaim = await db.Claim.findByPk(claim.id);
    res.json(getSuccessResponse(updatedClaim, 'Claim resolved'));

    // Fire-and-forget operations
    auditService.logAction(req.user.id, 'UPDATE', 'Claim', claim.id, { before: beforeSnapshot, after: updatedClaim?.toJSON?.() || claim.toJSON() }, req.ip).catch(() => {});
    webhookService.triggerWebhook('claim.resolved', {
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      compensationType,
      compensationAmount,
      resolvedAt: new Date()
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * POST /:id/credit-memo
 * Generate credit memo from resolved claim
 */
router.post('/:id/credit-memo', requireAuth, async (req, res, next) => {
  try {
    const claim = await db.Claim.findByPk(req.params.id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.SalesOrder, as: 'salesOrder' }
      ]
    });

    if (!claim) throw new NotFoundError('Claim not found');
    if (claim.status !== 'resolved') {
      return res.status(400).json({ success: false, error: { message: 'Only resolved claims can have credit memos', statusCode: 400 } });
    }

    if (claim.compensationType !== 'credit' && claim.compensationType !== 'refund') {
      return res.status(400).json({ success: false, error: { message: 'Credit memo can only be generated for credit/refund type resolutions', statusCode: 400 } });
    }

    // Create credit memo record (stored as a document/audit entry)
    const creditMemoId = uuidv4();
    const creditMemoData = {
      id: creditMemoId,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      customerId: claim.customerId,
      customerName: claim.customer?.companyName,
      amount: claim.compensationAmount,
      type: claim.compensationType,
      reason: claim.resolution,
      createdAt: new Date(),
      createdBy: req.user.id,
      status: 'issued'
    };

    // Update customer credit used for credit type
    if (claim.compensationType === 'credit' && claim.customer) {
      const creditAmount = parseFloat(claim.compensationAmount) || 0;
      await claim.customer.increment('creditUsed', { by: -creditAmount });
    }

    res.status(201).json(getSuccessResponse({
      ...creditMemoData,
      memo: `CM-${Date.now()}`,
      message: `Credit memo issued for claim ${claim.claimNumber}`
    }, 'Credit memo generated'));

    // Fire-and-forget operations
    auditService.logAction(req.user.id, 'CREATE', 'CreditMemo', creditMemoId, { data: creditMemoData }, req.ip).catch(() => {});
    webhookService.triggerWebhook('claim.credit_memo_issued', {
      claimId: claim.id,
      creditMemoId,
      amount: claim.compensationAmount,
      type: claim.compensationType,
      customerId: claim.customerId,
      issuedAt: new Date()
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:id/timeline
 * Get claim activity timeline
 */
router.get('/:id/timeline', requireAuth, async (req, res, next) => {
  try {
    const claim = await db.Claim.findByPk(req.params.id);
    if (!claim) throw new NotFoundError('Claim not found');

    // Fetch audit logs for this claim
    const timeline = await db.AuditLog.findAll({
      where: {
        entityType: 'Claim',
        entityId: req.params.id
      },
      include: [
        { model: db.User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }
      ],
      order: [['createdAt', 'ASC']]
    });

    // Build timeline with status transitions
    const events = [];

    // Add claim creation event
    events.push({
      timestamp: claim.createdAt,
      event: 'Claim Submitted',
      status: claim.status,
      description: `Claim #${claim.claimNumber} submitted for ${claim.type}`,
      type: 'created'
    });

    // Add audit log events
    timeline.forEach(log => {
      events.push({
        timestamp: log.createdAt,
        event: `${log.action}`,
        status: claim.status,
        description: log.details ? JSON.stringify(log.details) : `${log.action} by ${log.user?.firstName} ${log.user?.lastName}`,
        performedBy: `${log.user?.firstName} ${log.user?.lastName}`,
        type: log.action.toLowerCase()
      });
    });

    // Add resolved event if resolved
    if (claim.status === 'resolved' && claim.resolvedAt) {
      events.push({
        timestamp: claim.resolvedAt,
        event: 'Claim Resolved',
        status: 'resolved',
        description: `Resolved with ${claim.compensationType}: ${claim.resolution}`,
        compensationType: claim.compensationType,
        amount: claim.compensationAmount,
        type: 'resolved'
      });
    }

    res.json(getSuccessResponse({
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      currentStatus: claim.status,
      timeline: events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    }, 'Claim timeline retrieved'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
