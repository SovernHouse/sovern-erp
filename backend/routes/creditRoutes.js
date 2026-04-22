/**
 * Customer Credit Management Routes
 * @module routes/creditRoutes
 * @description Endpoints for managing customer credit limits, usage, and holds
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 * @requires ../services/auditService
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const webhookService = require('../services/webhookService');

/**
 * POST /api/credits/request-increase
 * Create a pending credit limit increase request
 */
router.post('/request-increase', requireAuth, async (req, res, next) => {
  try {
    const { customerId, requestedLimit, reason } = req.body;
    if (!customerId || requestedLimit === undefined || requestedLimit === null) {
      throw new ValidationError('customerId and requestedLimit are required');
    }
    if (isNaN(requestedLimit) || parseFloat(requestedLimit) < 0) {
      throw new ValidationError('requestedLimit must be a positive number');
    }
    const customer = await db.Customer.findByPk(customerId);
    if (!customer) throw new NotFoundError('Customer not found');
    const currentLimit = parseFloat(customer.creditLimit) || 0;
    const approval = await db.CreditApproval.create({
      customerId, requestedBy: req.user.id, currentLimit,
      requestedLimit: parseFloat(requestedLimit), reason: reason || null, status: 'pending'
    });
    res.json(getSuccessResponse({
      approvalId: approval.id, customerId: approval.customerId, customerName: customer.companyName,
      currentLimit, requestedLimit: parseFloat(requestedLimit), status: 'pending', createdAt: approval.createdAt
    }, 'Credit limit increase request created'));
    auditService.logAction(req.user.id, 'CREATE', 'CreditApproval', approval.id, { customerId, requestedLimit, reason }, req.ip).catch(() => {});
    notificationService.emitCustomerUpdate(customerId, 'credit_approval_requested', { approvalId: approval.id, requestedLimit }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/credits/pending-approvals
 * List pending credit approval requests (finance/admin only)
 */
router.get('/pending-approvals', requireAuth, requireRole('finance', 'admin'), async (req, res, next) => {
  try {
    const approvals = await db.CreditApproval.findAll({
      where: { status: 'pending' },
      include: [
        { model: db.Customer, as: 'customer', attributes: ['id', 'companyName', 'email'] },
        { model: db.User, as: 'requester', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(getSuccessResponse({
      count: approvals.length,
      approvals: approvals.map(a => ({
        id: a.id, customerId: a.customerId, customerName: a.customer?.companyName,
        customerEmail: a.customer?.email, currentLimit: parseFloat(a.currentLimit || 0),
        requestedLimit: parseFloat(a.requestedLimit), reason: a.reason,
        requestedBy: a.requester ? `${a.requester.firstName} ${a.requester.lastName}` : null,
        requestedByEmail: a.requester?.email, status: a.status, createdAt: a.createdAt
      }))
    }, 'Pending approvals retrieved'));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/credits/approvals/:id/approve
 */
router.put('/approvals/:id/approve', requireAuth, requireRole('finance', 'admin'), async (req, res, next) => {
  try {
    const { approvalNotes } = req.body;
    const approval = await db.CreditApproval.findByPk(req.params.id);
    if (!approval) throw new NotFoundError('Approval request not found');
    if (approval.status !== 'pending') throw new ValidationError(`Cannot approve request with status '${approval.status}'`);
    const customer = await db.Customer.findByPk(approval.customerId);
    if (!customer) throw new NotFoundError('Customer not found');
    const beforeSnapshot = customer.toJSON();
    await customer.update({ creditLimit: approval.requestedLimit });
    const approvalSnapshot = approval.toJSON();
    await approval.update({ approvedBy: req.user.id, approvalNotes: approvalNotes || null, status: 'approved', approvedAt: new Date() });
    const updatedApproval = await db.CreditApproval.findByPk(approval.id, {
      include: [
        { model: db.Customer, as: 'customer', attributes: ['id', 'companyName'] },
        { model: db.User, as: 'requester', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: db.User, as: 'approver', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ]
    });
    res.json(getSuccessResponse({
      approval: { id: updatedApproval.id, customerId: updatedApproval.customerId, customerName: updatedApproval.customer?.companyName, status: updatedApproval.status, approvalNotes: updatedApproval.approvalNotes, approvedAt: updatedApproval.approvedAt },
      customer: { id: customer.id, companyName: customer.companyName, newCreditLimit: parseFloat(customer.creditLimit) }
    }, 'Credit limit increase approved'));
    auditService.logAction(req.user.id, 'UPDATE', 'CreditApproval', approval.id, { before: approvalSnapshot, after: updatedApproval?.toJSON?.() || approval.toJSON() }, req.ip).catch(() => {});
    auditService.logAction(req.user.id, 'UPDATE', 'Customer', customer.id, { before: beforeSnapshot, after: customer.toJSON() }, req.ip).catch(() => {});
    notificationService.emitCustomerUpdate(approval.customerId, 'credit_limit_approved', { newLimit: parseFloat(customer.creditLimit) }).catch(() => {});
    webhookService.triggerWebhook('customer.credit_limit_approved', { customerId: customer.id, customerName: customer.companyName, newCreditLimit: parseFloat(customer.creditLimit), approvedBy: req.user.id, approvalNotes, approvedAt: new Date() }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/credits/approvals/:id/reject
 */
router.put('/approvals/:id/reject', requireAuth, requireRole('finance', 'admin'), async (req, res, next) => {
  try {
    const { approvalNotes } = req.body;
    if (!approvalNotes) throw new ValidationError('approvalNotes are required for rejection');
    const approval = await db.CreditApproval.findByPk(req.params.id);
    if (!approval) throw new NotFoundError('Approval request not found');
    if (approval.status !== 'pending') throw new ValidationError(`Cannot reject request with status '${approval.status}'`);
    const approvalSnapshot = approval.toJSON();
    await approval.update({ approvedBy: req.user.id, approvalNotes, status: 'rejected', approvedAt: new Date() });
    const updatedApproval = await db.CreditApproval.findByPk(approval.id, {
      include: [
        { model: db.Customer, as: 'customer', attributes: ['id', 'companyName'] },
        { model: db.User, as: 'requester', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: db.User, as: 'approver', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ]
    });
    res.json(getSuccessResponse({ id: updatedApproval.id, customerId: updatedApproval.customerId, customerName: updatedApproval.customer?.companyName, status: updatedApproval.status, rejectionNotes: updatedApproval.approvalNotes, rejectedAt: updatedApproval.approvedAt }, 'Credit limit increase request rejected'));
    auditService.logAction(req.user.id, 'UPDATE', 'CreditApproval', approval.id, { before: approvalSnapshot, after: updatedApproval?.toJSON?.() || approval.toJSON() }, req.ip).catch(() => {});
    notificationService.emitCustomerUpdate(approval.customerId, 'credit_limit_rejected', { rejectionNotes: approvalNotes }).catch(() => {});
    webhookService.triggerWebhook('customer.credit_limit_rejected', { customerId: approval.customerId, customerName: updatedApproval.customer?.companyName, rejectionNotes: approvalNotes, rejectedBy: req.user.id, rejectedAt: new Date() }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PARAMETERIZED routes MUST come after named routes

/**
 * GET /api/credits/:customerId
 * Get customer credit information (limit, used, available)
 */
router.get('/:customerId', requireAuth, async (req, res, next) => {
  req.params.id = req.params.customerId;  // For backward compatibility with controller
  try {
    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) throw new NotFoundError('Customer not found');

    const creditLimit = parseFloat(customer.creditLimit) || 0;
    const creditUsed = parseFloat(customer.creditUsed) || 0;
    const available = creditLimit - creditUsed;

    res.json(getSuccessResponse({
      customerId: customer.id,
      customerName: customer.companyName,
      creditLimit,
      creditUsed,
      available,
      creditHold: customer.creditHold,
      creditHoldReason: customer.creditHoldReason,
      creditUtilization: creditLimit > 0 ? ((creditUsed / creditLimit) * 100).toFixed(2) + '%' : '0%'
    }, 'Customer credit information retrieved'));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/credits/:customerId/credit-limit
 * Set or update customer credit limit
 */
router.put('/:customerId/credit-limit', requireAuth, async (req, res, next) => {
  req.params.id = req.params.customerId;  // For backward compatibility with controller
  try {
    const { creditLimit } = req.body;

    if (creditLimit === undefined || creditLimit === null) {
      throw new ValidationError('creditLimit is required');
    }

    if (isNaN(creditLimit) || parseFloat(creditLimit) < 0) {
      throw new ValidationError('creditLimit must be a positive number');
    }

    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) throw new NotFoundError('Customer not found');

    const beforeSnapshot = customer.toJSON();
    const newLimit = parseFloat(creditLimit);

    await customer.update({
      creditLimit: newLimit
    });

    const updatedCustomer = await db.Customer.findByPk(customer.id);
    const creditUsed = parseFloat(updatedCustomer.creditUsed) || 0;
    const available = newLimit - creditUsed;

    res.json(getSuccessResponse({
      customerId: updatedCustomer.id,
      customerName: updatedCustomer.companyName,
      creditLimit: newLimit,
      creditUsed,
      available
    }, 'Credit limit updated'));

    // Fire-and-forget operations
    auditService.logAction(req.user.id, 'UPDATE', 'Customer', customer.id, { before: beforeSnapshot, after: updatedCustomer?.toJSON?.() || customer.toJSON() }, req.ip).catch(() => {});
    webhookService.triggerWebhook('customer.credit_limit_updated', {
      customerId: customer.id,
      customerName: customer.companyName,
      newCreditLimit: newLimit,
      updatedAt: new Date()
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/credits/:customerId/credit-hold
 * Place customer on credit hold
 */
router.post('/:customerId/credit-hold', requireAuth, async (req, res, next) => {
  req.params.id = req.params.customerId;  // For backward compatibility with controller
  try {
    const { reason } = req.body;

    if (!reason) {
      throw new ValidationError('reason for credit hold is required');
    }

    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) throw new NotFoundError('Customer not found');

    if (customer.creditHold) {
      return res.status(400).json({ success: false, error: { message: 'Customer is already on credit hold', statusCode: 400 } });
    }

    const beforeSnapshot = customer.toJSON();

    await customer.update({
      creditHold: true,
      creditHoldReason: reason
    });

    const updatedCustomer = await db.Customer.findByPk(customer.id);
    res.json(getSuccessResponse({
      customerId: updatedCustomer.id,
      customerName: updatedCustomer.companyName,
      creditHold: true,
      creditHoldReason: reason
    }, 'Customer placed on credit hold'));

    // Fire-and-forget operations
    auditService.logAction(req.user.id, 'UPDATE', 'Customer', customer.id, { action: 'credit_hold_placed', reason, before: beforeSnapshot, after: updatedCustomer?.toJSON?.() || customer.toJSON() }, req.ip).catch(() => {});
    notificationService.emitCustomerUpdate(customer.id, 'credit_hold', { reason }).catch(() => {});
    webhookService.triggerWebhook('customer.credit_hold_placed', {
      customerId: customer.id,
      customerName: customer.companyName,
      reason,
      holdAt: new Date()
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/credits/:customerId/credit-release
 * Release customer from credit hold
 */
router.post('/:customerId/credit-release', requireAuth, async (req, res, next) => {
  req.params.id = req.params.customerId;  // For backward compatibility with controller
  try {
    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) throw new NotFoundError('Customer not found');

    if (!customer.creditHold) {
      return res.status(400).json({ success: false, error: { message: 'Customer is not on credit hold', statusCode: 400 } });
    }

    const beforeSnapshot = customer.toJSON();
    const previousReason = customer.creditHoldReason;

    await customer.update({
      creditHold: false,
      creditHoldReason: null
    });

    const updatedCustomer = await db.Customer.findByPk(customer.id);
    res.json(getSuccessResponse({
      customerId: updatedCustomer.id,
      customerName: updatedCustomer.companyName,
      creditHold: false
    }, 'Customer released from credit hold'));

    // Fire-and-forget operations
    auditService.logAction(req.user.id, 'UPDATE', 'Customer', customer.id, { action: 'credit_hold_released', previousReason, before: beforeSnapshot, after: updatedCustomer?.toJSON?.() || customer.toJSON() }, req.ip).catch(() => {});
    notificationService.emitCustomerUpdate(customer.id, 'credit_release').catch(() => {});
    webhookService.triggerWebhook('customer.credit_released', {
      customerId: customer.id,
      customerName: customer.companyName,
      releasedAt: new Date()
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
