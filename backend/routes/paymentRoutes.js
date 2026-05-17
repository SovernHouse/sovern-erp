/**
 * Payment Management Routes
 * @module routes/paymentRoutes
 * @description Endpoints for managing payments and payment records
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');
const logger = require('../utils/logger.js');

/**
 * List all payments with pagination and filtering
 * @route GET /api/payments
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @param {string} invoiceId - Filter by invoice ID
 * @param {string} status - Filter by payment status
 * @returns {Object} Paginated list of payments
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, invoiceId, status } = req.query;
    const { offset } = getPagination(page, limit);
    const where = {};
    if (invoiceId) where.invoiceId = invoiceId;
    if (status) where.status = status;

    const { count, rows } = await db.Payment.findAndCountAll({
      where,
      include: [
        { model: db.Invoice, include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }] }
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
    const payment = await db.Payment.findByPk(req.params.id, {
      include: [{ model: db.Invoice, include: [{ model: db.Customer, as: 'customer' }] }]
    });

    if (!payment) throw new NotFoundError('Payment not found');
    res.json(getSuccessResponse(payment));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/confirm', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const payment = await db.Payment.findByPk(req.params.id, {
      include: [{ model: db.Invoice }],
      transaction
    });

    if (!payment) {
      await transaction.rollback();
      throw new NotFoundError('Payment not found');
    }

    // Lock invoice for update to prevent concurrent modifications
    const invoice = await db.Invoice.findByPk(payment.invoiceId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!invoice) {
      await transaction.rollback();
      throw new NotFoundError('Invoice not found');
    }

    // Update payment status within transaction
    await payment.update({ status: 'confirmed' }, { transaction });

    await transaction.commit();

    // Phase 4.25f: sum all confirmed Payments for the Invoice and
    // update its status idempotently. Delegated to workflowService so
    // the rule is shared between REST and future MCP/AI paths.
    // Best-effort: failure logs but does not roll back the Payment
    // confirm (the user already approved the payment record itself).
    try {
      const workflowService = require('../services/workflowService');
      await workflowService.onPaymentConfirmed(payment, {
        userId: req.user && req.user.id,
        ip: req.ip,
        source: 'rest_payment_confirm',
      });
    } catch (chainErr) {
      const auditService = require('../services/auditService');
      auditService.logAction(
        (req.user && req.user.id) || null,
        'auto_update_failed',
        'Payment',
        payment.id,
        { error: chainErr && chainErr.message, chainStep: 'onPaymentConfirmed', phase: '4.25f' },
        req.ip || null,
      ).catch(() => {});
    }


    // Send payment confirmation email (fire-and-forget)
    try {
      const customer = await db.Customer.findByPk(invoice.customerId);
      if (customer && customer.email) {
        emailService.sendPaymentConfirmationEmail(customer, invoice, payment).catch(err => {
          logger.error('Error sending payment confirmation email:', err.message);
        });
      }
    } catch (emailError) {
      logger.error('Error in email notification:', emailError.message);
      // Don't fail the request if email fails
    }

    res.json(getSuccessResponse(payment, 'Payment confirmed'));
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.patch('/:id/reject', requireAuth, async (req, res, next) => {
  try {
    const payment = await db.Payment.findByPk(req.params.id);

    if (!payment) throw new NotFoundError('Payment not found');

    await payment.update({ status: 'rejected' });
    res.json(getSuccessResponse(payment, 'Payment rejected'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const payment = await db.Payment.findByPk(req.params.id, { transaction });

    if (!payment) {
      await transaction.rollback();
      throw new NotFoundError('Payment not found');
    }

    // Lock invoice for update
    const invoice = await db.Invoice.findByPk(payment.invoiceId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!invoice) {
      await transaction.rollback();
      throw new NotFoundError('Invoice not found');
    }

    const newPaidAmount = Math.max(0, parseFloat(invoice.paidAmount) - parseFloat(payment.amount));
    const newBalance = parseFloat(invoice.total) - newPaidAmount;
    const newStatus = newPaidAmount === 0 ? 'unpaid' : 'partially_paid';

    // Update invoice
    await invoice.update({
      paidAmount: newPaidAmount,
      balance: newBalance,
      status: newStatus
    }, { transaction });

    // Delete payment
    await payment.destroy({ transaction });

    await transaction.commit();
    res.json(getSuccessResponse(null, 'Payment deleted'));
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

module.exports = router;
