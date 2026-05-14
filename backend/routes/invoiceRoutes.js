/**
 * Invoice Management Routes
 * @module routes/invoiceRoutes
 * @description Endpoints for managing invoices including creation, payment tracking, aging reports, and PDF generation
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 * @requires ../services/auditService
 * @requires ../services/emailService
 * @requires ../services/documentGenerator
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { brandScope } = require('../middleware/brandScope');
const { getPagination, getPaginatedResponse, getSuccessResponse, generateDocumentNumber } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
const { Op } = require('sequelize');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const documentGenerator = require('../services/documentGenerator');
const notificationService = require('../services/notificationService');
const webhookService = require('../services/webhookService');
const { validateFinancials } = require('../utils/validateFinancials');
const logger = require('../utils/logger.js');

// Phase 1 Commit 3b-B: brand-scope every invoice request.
router.use(requireAuth, brandScope);

/**
 * List all invoices with pagination and filtering
 * @route GET /api/invoices
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @param {string} status - Filter by invoice status
 * @param {string} customerId - Filter by customer ID
 * @returns {Object} Paginated list of invoices
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, customerId } = req.query;
    const { offset } = getPagination(page, limit);
    const where = { ...(req.brandScope?.where || {}), deletedAt: null };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const { count, rows } = await db.Invoice.findAndCountAll({
      where,
      include: [
        { model: db.Customer, as: 'customer', attributes: ['companyName'] },
        { model: db.SalesOrder, as: 'salesOrder', attributes: ['orderNumber'] },
        { association: 'payments' }
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

// GET /aging-report - System-wide aging report (MUST be before /:id)
router.get('/aging-report', requireAuth, async (req, res, next) => {
  try {
    const invoices = await db.Invoice.findAll({
      where: {
        deletedAt: null,
        status: { [Op.in]: ['draft', 'sent', 'partially_paid', 'overdue'] }
      },
      include: [
        { model: db.Customer, as: 'customer', attributes: ['companyName'] },
        { association: 'payments' }
      ]
    });

    const userTimezone = req.user?.timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Taipei';
    const now = dayjs().tz(userTimezone);
    const agingReport = { current: [], '30_days': [], '60_days': [], '90_plus': [] };

    invoices.forEach(invoice => {
      const daysDue = now.diff(dayjs(invoice.dueDate).tz(userTimezone), 'day');
      const invoiceData = {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customer?.companyName,
        customerId: invoice.customerId,
        total: invoice.total,
        balance: invoice.balance,
        status: invoice.status,
        dueDate: invoice.dueDate,
        daysDue
      };

      if (daysDue < 0) agingReport.current.push(invoiceData);
      else if (daysDue <= 30) agingReport['30_days'].push(invoiceData);
      else if (daysDue <= 60) agingReport['60_days'].push(invoiceData);
      else agingReport['90_plus'].push(invoiceData);
    });

    const summary = {
      total_invoices: invoices.length,
      total_outstanding: invoices.reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0),
      current_amount: agingReport.current.reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0),
      days_30_amount: agingReport['30_days'].reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0),
      days_60_amount: agingReport['60_days'].reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0),
      days_90_plus_amount: agingReport['90_plus'].reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0),
      current_count: agingReport.current.length,
      days_30_count: agingReport['30_days'].length,
      days_60_count: agingReport['60_days'].length,
      days_90_plus_count: agingReport['90_plus'].length
    };

    res.json(getSuccessResponse({ report: agingReport, summary }, 'Aging report generated'));
  } catch (error) {
    next(error);
  }
});

// GET /summary - Invoice summary stats (MUST be before /:id)
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const invoices = await db.Invoice.findAll({
      where: { deletedAt: null },
      attributes: ['status', 'total', 'balance', 'paidAmount']
    });

    const summary = {
      total_invoices: invoices.length,
      by_status: { draft: 0, sent: 0, partially_paid: 0, paid: 0, overdue: 0, cancelled: 0 },
      financial: { total_amount: 0, total_paid: 0, total_outstanding: 0 }
    };

    invoices.forEach(invoice => {
      summary.by_status[invoice.status] = (summary.by_status[invoice.status] || 0) + 1;
      summary.financial.total_amount += parseFloat(invoice.total || 0);
      summary.financial.total_paid += parseFloat(invoice.paidAmount || 0);
      summary.financial.total_outstanding += parseFloat(invoice.balance || 0);
    });

    const totalAmount = summary.financial.total_amount;
    summary.financial.paid_percentage = totalAmount > 0 ? ((summary.financial.total_paid / totalAmount) * 100).toFixed(2) : 0;
    summary.financial.outstanding_percentage = totalAmount > 0 ? ((summary.financial.total_outstanding / totalAmount) * 100).toFixed(2) : 0;

    res.json(getSuccessResponse(summary, 'Invoice summary retrieved'));
  } catch (error) {
    next(error);
  }
});

// POST / - Create invoice
router.post('/', requireAuth, async (req, res, next) => {
  try {
    validateFinancials(req.body);
    const { salesOrderId, customerId, type, subtotal, discount, tax, dueDate, paymentTerms } = req.body;
    const total = subtotal - (discount || 0) + (tax || 0);

    const invoice = await db.Invoice.create({
      id: uuidv4(),
      invoiceNumber: generateDocumentNumber('INV'),
      salesOrderId: salesOrderId || null,
      customerId,
      type: type || 'sales',
      status: 'draft',
      subtotal,
      discount: discount || 0,
      tax: tax || 0,
      total,
      currency: 'USD',
      dueDate: new Date(dueDate),
      balance: total,
      paymentTerms: paymentTerms || 'Net 30'
    });

    res.status(201).json(getSuccessResponse(invoice, 'Invoice created'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Invoice', invoice.id, { data: invoice.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// POST /generate-from-sales-order - Auto-generate invoice from SO
router.post('/generate-from-sales-order', requireAuth, async (req, res, next) => {
  try {
    const { salesOrderId, dueDate, paymentTerms, notes } = req.body;

    if (!salesOrderId) throw new ValidationError('salesOrderId is required');

    const salesOrder = await db.SalesOrder.findByPk(salesOrderId, {
      include: [{ model: db.Customer, as: 'customer' }]
    });

    if (!salesOrder) throw new NotFoundError('Sales Order not found');

    const invoiceNumber = generateDocumentNumber('INV');

    const invoice = await db.Invoice.create({
      id: uuidv4(),
      invoiceNumber,
      salesOrderId,
      customerId: salesOrder.customerId,
      type: 'sales',
      status: 'draft',
      subtotal: salesOrder.subtotal,
      discount: salesOrder.discount,
      tax: salesOrder.tax,
      total: salesOrder.total,
      currency: salesOrder.currency,
      dueDate: dueDate ? new Date(dueDate) : dayjs().add(30, 'day').toDate(),
      paidAmount: 0,
      balance: salesOrder.total,
      paymentTerms: paymentTerms || salesOrder.customer?.paymentTerms || 'Net 30',
      notes: notes || null
    });

    const completeInvoice = await db.Invoice.findByPk(invoice.id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.SalesOrder, as: 'salesOrder' },
        { association: 'payments' }
      ]
    });

    res.status(201).json(getSuccessResponse(completeInvoice, 'Invoice generated from sales order'));

    // Fire-and-forget audit log and webhooks
    auditService.logAction(req.user.id, 'CREATE', 'Invoice', invoice.id, { data: completeInvoice?.toJSON?.() || invoice.toJSON(), salesOrderId }, req.ip).catch(() => {});
    webhookService.triggerWebhook('invoice.created', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      salesOrderId: invoice.salesOrderId,
      customerId: invoice.customerId,
      total: invoice.total,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      status: invoice.status,
      createdAt: invoice.createdAt
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /:id - Get single invoice
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const invoice = await db.Invoice.findByPk(req.params.id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.SalesOrder, as: 'salesOrder' },
        { association: 'payments' },
        { association: 'items', include: [{ model: db.Product, as: 'product' }] }
      ]
    });

    if (!invoice || invoice.deletedAt) throw new NotFoundError('Invoice not found');

    // Phase 3, C13: 404-on-wrong-brand.
    const { isAccessibleByBrandCode } = require('../utils/notFoundOnWrongBrand');
    if (!isAccessibleByBrandCode(req, invoice.brandCode)) {
      throw new NotFoundError('Invoice not found');
    }

    res.json(getSuccessResponse(invoice));
  } catch (error) {
    next(error);
  }
});

// PUT /:id - Update invoice
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const invoice = await db.Invoice.findByPk(req.params.id);
    if (!invoice || invoice.deletedAt) throw new NotFoundError('Invoice not found');

    const beforeSnapshot = invoice.toJSON();

    if (invoice.status === 'paid') {
      throw new ValidationError('Cannot edit paid invoices');
    }

    if (invoice.status !== 'draft') {
      throw new ValidationError('Only draft invoices can be updated');
    }

    const { customerId, type, subtotal, discount, tax, dueDate, paymentTerms, notes } = req.body;

    let total = parseFloat(invoice.total);
    if (subtotal !== undefined || discount !== undefined || tax !== undefined) {
      const st = subtotal !== undefined ? subtotal : parseFloat(invoice.subtotal);
      const disc = discount !== undefined ? discount : parseFloat(invoice.discount);
      const tx = tax !== undefined ? tax : parseFloat(invoice.tax);
      total = st - disc + tx;
    }

    await invoice.update({
      ...(customerId && { customerId }),
      ...(type && { type }),
      ...(subtotal !== undefined && { subtotal }),
      ...(discount !== undefined && { discount }),
      ...(tax !== undefined && { tax }),
      total,
      balance: total - parseFloat(invoice.paidAmount),
      ...(dueDate && { dueDate: new Date(dueDate) }),
      ...(paymentTerms && { paymentTerms }),
      ...(notes !== undefined && { notes })
    });

    const updatedInvoice = await db.Invoice.findByPk(req.params.id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.SalesOrder, as: 'salesOrder' },
        { association: 'payments' }
      ]
    });

    res.json(getSuccessResponse(updatedInvoice, 'Invoice updated'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Invoice', invoice.id, { before: beforeSnapshot, after: updatedInvoice?.toJSON?.() || invoice.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PATCH /:id/send - Mark invoice as sent
router.patch('/:id/send', requireAuth, async (req, res, next) => {
  try {
    const invoice = await db.Invoice.findByPk(req.params.id);
    if (!invoice || invoice.deletedAt) throw new NotFoundError('Invoice not found');

    // Phase 4, C16: FW invoices are internal records — factory sends to
    // the buyer. Defense-in-depth alongside the UI disable.
    if (invoice.brandCode === 'FW') {
      auditService.logAction(req.user.id, 'fw_send_blocked', 'Invoice', invoice.id, {
        attemptedBy: req.user.email || req.user.id,
        invoiceNumber: invoice.invoiceNumber,
      }, req.ip).catch(() => {});
      return res.status(400).json({
        success: false,
        message: 'FlorWay invoices are internal records; the factory sends the document to the buyer. Auto-send is disabled.',
      });
    }

    const beforeStatus = invoice.status;

    if (invoice.status !== 'draft') {
      throw new ValidationError('Only draft invoices can be marked as sent');
    }

    await invoice.update({ status: 'sent' });

    const updatedInvoice = await db.Invoice.findByPk(req.params.id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.SalesOrder, as: 'salesOrder' },
        { association: 'payments' }
      ]
    });

    res.json(getSuccessResponse(updatedInvoice, 'Invoice marked as sent'));

    // Fire-and-forget email and audit log
    emailService.sendInvoiceEmail(updatedInvoice.customer, updatedInvoice).catch(err => logger.error('[EMAIL] Error:', err.message));
    auditService.logAction(req.user.id, 'UPDATE', 'Invoice', invoice.id, { statusChange: { before: beforeStatus, after: 'sent' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// POST /:id/record-payment
router.post('/:id/record-payment', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    validateFinancials(req.body);
    const { amount, method, reference } = req.body;

    // FIX BUG 1: Use transaction with row locking to prevent race conditions
    const invoice = await db.Invoice.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!invoice || invoice.deletedAt) throw new NotFoundError('Invoice not found');

    const beforeSnapshot = invoice.toJSON();

    const payment = await db.Payment.create({
      id: uuidv4(),
      invoiceId: invoice.id,
      amount,
      currency: invoice.currency,
      method,
      reference,
      status: 'pending'
    }, { transaction });

    // Read the current paid amount from the locked row
    const paidAmount = parseFloat(invoice.paidAmount) + parseFloat(amount);
    const newBalance = parseFloat(invoice.total) - paidAmount;
    const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

    await invoice.update({
      paidAmount,
      balance: Math.max(0, newBalance),
      status: newStatus
    }, { transaction });

    await transaction.commit();

    const updatedInvoice = await db.Invoice.findByPk(invoice.id);

    res.status(201).json(getSuccessResponse(payment, 'Payment recorded'));

    // Fire-and-forget email, audit log, real-time notification, and webhooks
    emailService.sendPaymentConfirmationEmail(updatedInvoice.customer || invoice.customer, updatedInvoice || invoice, payment).catch(err => logger.error('[EMAIL] Error:', err.message));
    auditService.logAction(req.user.id, 'UPDATE', 'Invoice', invoice.id, { action: 'payment_recorded', amount, method, before: beforeSnapshot, after: updatedInvoice?.toJSON?.() }, req.ip).catch(() => {});

    // Get admin users for payment notification
    const admins = await db.User.findAll({ where: { role: 'admin' }, attributes: ['id'] }).catch(() => []);
    const adminIds = admins.map(a => a.id);
    notificationService.emitPaymentReceived(invoice.id, amount, invoice.customerId, adminIds).catch(() => {});

    webhookService.triggerWebhook('payment.received', {
      paymentId: payment.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount,
      method,
      reference,
      invoiceStatus: updatedInvoice.status || newStatus,
      balance: updatedInvoice.balance || Math.max(0, newBalance),
      receivedAt: payment.createdAt
    }).catch(() => {});
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// GET /:id/aging - Per-invoice aging info
router.get('/:id/aging', requireAuth, async (req, res, next) => {
  try {
    const invoices = await db.Invoice.findAll({
      where: {
        deletedAt: null,
        status: { [Op.in]: ['draft', 'sent', 'partially_paid', 'overdue'] }
      },
      include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }]
    });

    const now = dayjs();
    const aging = {
      current: invoices.filter(i => dayjs(i.dueDate).isAfter(now)),
      '30_days': invoices.filter(i => {
        const diff = now.diff(dayjs(i.dueDate), 'day');
        return diff > 0 && diff <= 30;
      }),
      '60_days': invoices.filter(i => {
        const diff = now.diff(dayjs(i.dueDate), 'day');
        return diff > 30 && diff <= 60;
      }),
      '90_plus': invoices.filter(i => {
        const diff = now.diff(dayjs(i.dueDate), 'day');
        return diff > 90;
      })
    };

    res.json(getSuccessResponse(aging));
  } catch (error) {
    next(error);
  }
});

// GET /:id/overdue
router.get('/:id/overdue', requireAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const overdue = await db.Invoice.findAll({
      where: {
        deletedAt: null,
        status: { [Op.in]: ['draft', 'sent', 'partially_paid'] },
        dueDate: { [Op.lt]: now }
      },
      include: [{ model: db.Customer, as: 'customer' }],
      order: [['dueDate', 'ASC']]
    });

    res.json(getSuccessResponse(overdue));
  } catch (error) {
    next(error);
  }
});

// GET /:id/pdf - Generate invoice PDF
router.get('/:id/pdf', requireAuth, async (req, res, next) => {
  try {
    const invoice = await db.Invoice.findByPk(req.params.id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.SalesOrder, as: 'salesOrder' },
        { association: 'items', include: [{ model: db.Product, as: 'product' }] }
      ]
    });

    if (!invoice || invoice.deletedAt) throw new NotFoundError('Invoice not found');

    const pdfFile = await documentGenerator.generateInvoicePDF(invoice, invoice.salesOrder, invoice.customer);
    res.json(getSuccessResponse({ pdfFile }, 'Invoice PDF generated'));
  } catch (error) {
    next(error);
  }
});

// POST /send-reminders - Send payment reminders for overdue invoices (admin/finance only)
router.post('/send-reminders', requireAuth, requireRole('admin', 'finance'), async (req, res, next) => {
  try {
    const now = new Date();
    const overdueInvoices = await db.Invoice.findAll({
      where: {
        deletedAt: null,
        status: { [Op.in]: ['sent', 'partially_paid', 'overdue'] },
        dueDate: { [Op.lt]: now }
      },
      include: [{ model: db.Customer, as: 'customer' }]
    });

    const reminders = [];
    for (const invoice of overdueInvoices) {
      try {
        await emailService.sendPaymentReminderEmail(invoice.customer, invoice);
        reminders.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customer.companyName,
          status: 'sent'
        });
      } catch (err) {
        logger.error(`Failed to send reminder for invoice ${invoice.invoiceNumber}:`, err);
        reminders.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customer.companyName,
          status: 'failed',
          error: err.message
        });
      }
    }

    res.json(getSuccessResponse({
      totalSent: reminders.filter(r => r.status === 'sent').length,
      totalFailed: reminders.filter(r => r.status === 'failed').length,
      reminders
    }, 'Payment reminders sent'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'SEND_REMINDERS', 'Invoice', 'batch', { count: reminders.length }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// DELETE /:id - Soft delete invoice
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const invoice = await db.Invoice.findByPk(req.params.id);
    if (!invoice || invoice.deletedAt) throw new NotFoundError('Invoice not found');

    const beforeSnapshot = invoice.toJSON();

    await invoice.update({ deletedAt: new Date() });

    res.json(getSuccessResponse({ id: invoice.id }, 'Invoice deleted'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Invoice', invoice.id, { before: beforeSnapshot }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// POST /:id/items - Add line item to invoice
router.post('/:id/items', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { productId, description, quantity, unit, unitPrice, discount, tax, notes } = req.body;

    const invoice = await db.Invoice.findByPk(req.params.id, { transaction });
    if (!invoice || invoice.deletedAt) throw new NotFoundError('Invoice not found');

    if (invoice.status !== 'draft') {
      throw new ValidationError('Can only add items to draft invoices');
    }

    const product = await db.Product.findByPk(productId, { transaction });
    if (!product) throw new NotFoundError('Product not found');

    const itemTotal = quantity * unitPrice - (discount || 0) + (tax || 0);

    const item = await db.InvoiceItem.create({
      id: uuidv4(),
      invoiceId: invoice.id,
      productId,
      description: description || product.name,
      quantity,
      unit: unit || 'sqm',
      unitPrice,
      total: itemTotal,
      discount: discount || 0,
      tax: tax || 0,
      notes: notes || null
    }, { transaction });

    // Recalculate invoice totals
    const items = await db.InvoiceItem.findAll({
      where: { invoiceId: invoice.id },
      transaction
    });

    const newSubtotal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
    const newDiscount = items.reduce((sum, i) => sum + parseFloat(i.discount || 0), 0);
    const newTax = items.reduce((sum, i) => sum + parseFloat(i.tax || 0), 0);
    const newTotal = newSubtotal - newDiscount + newTax;

    await invoice.update({
      subtotal: newSubtotal,
      discount: newDiscount,
      tax: newTax,
      total: newTotal,
      balance: newTotal - parseFloat(invoice.paidAmount)
    }, { transaction });

    await transaction.commit();

    const updatedInvoice = await db.Invoice.findByPk(invoice.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { association: 'payments' }
      ]
    });

    res.status(201).json(getSuccessResponse(updatedInvoice, 'Line item added'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'InvoiceItem', item.id, { invoiceId: invoice.id, data: item.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// PUT /:id/items/:itemId - Update line item
router.put('/:id/items/:itemId', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { description, quantity, unit, unitPrice, discount, tax, notes } = req.body;

    const invoice = await db.Invoice.findByPk(req.params.id, { transaction });
    if (!invoice || invoice.deletedAt) throw new NotFoundError('Invoice not found');

    if (invoice.status !== 'draft') {
      throw new ValidationError('Can only edit items in draft invoices');
    }

    const item = await db.InvoiceItem.findByPk(req.params.itemId, { transaction });
    if (!item || item.invoiceId !== req.params.id) throw new NotFoundError('Line item not found');

    const beforeSnapshot = item.toJSON();

    const newUnitPrice = unitPrice !== undefined ? unitPrice : item.unitPrice;
    const newQuantity = quantity !== undefined ? quantity : item.quantity;
    const newDiscount = discount !== undefined ? discount : item.discount;
    const newTax = tax !== undefined ? tax : item.tax;
    const newTotal = newQuantity * newUnitPrice - newDiscount + newTax;

    await item.update({
      ...(description && { description }),
      ...(quantity !== undefined && { quantity: newQuantity }),
      ...(unit && { unit }),
      ...(unitPrice !== undefined && { unitPrice: newUnitPrice }),
      ...(discount !== undefined && { discount: newDiscount }),
      ...(tax !== undefined && { tax: newTax }),
      total: newTotal,
      ...(notes !== undefined && { notes })
    }, { transaction });

    // Recalculate invoice totals
    const items = await db.InvoiceItem.findAll({
      where: { invoiceId: invoice.id },
      transaction
    });

    const newSubtotal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
    const totalDiscount = items.reduce((sum, i) => sum + parseFloat(i.discount || 0), 0);
    const totalTax = items.reduce((sum, i) => sum + parseFloat(i.tax || 0), 0);
    const newInvoiceTotal = newSubtotal - totalDiscount + totalTax;

    await invoice.update({
      subtotal: newSubtotal,
      discount: totalDiscount,
      tax: totalTax,
      total: newInvoiceTotal,
      balance: newInvoiceTotal - parseFloat(invoice.paidAmount)
    }, { transaction });

    await transaction.commit();

    const updatedInvoice = await db.Invoice.findByPk(invoice.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { association: 'payments' }
      ]
    });

    res.json(getSuccessResponse(updatedInvoice, 'Line item updated'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'InvoiceItem', item.id, { before: beforeSnapshot, after: item.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// DELETE /:id/items/:itemId - Remove line item
router.delete('/:id/items/:itemId', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const invoice = await db.Invoice.findByPk(req.params.id, { transaction });
    if (!invoice || invoice.deletedAt) throw new NotFoundError('Invoice not found');

    if (invoice.status !== 'draft') {
      throw new ValidationError('Can only remove items from draft invoices');
    }

    const item = await db.InvoiceItem.findByPk(req.params.itemId, { transaction });
    if (!item || item.invoiceId !== req.params.id) throw new NotFoundError('Line item not found');

    const beforeSnapshot = item.toJSON();

    await item.destroy({ transaction });

    // Recalculate invoice totals
    const items = await db.InvoiceItem.findAll({
      where: { invoiceId: invoice.id },
      transaction
    });

    const newSubtotal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
    const totalDiscount = items.reduce((sum, i) => sum + parseFloat(i.discount || 0), 0);
    const totalTax = items.reduce((sum, i) => sum + parseFloat(i.tax || 0), 0);
    const newTotal = newSubtotal - totalDiscount + totalTax;

    await invoice.update({
      subtotal: newSubtotal,
      discount: totalDiscount,
      tax: totalTax,
      total: newTotal,
      balance: newTotal - parseFloat(invoice.paidAmount)
    }, { transaction });

    await transaction.commit();

    const updatedInvoice = await db.Invoice.findByPk(invoice.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { association: 'payments' }
      ]
    });

    res.json(getSuccessResponse(updatedInvoice, 'Line item removed'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'InvoiceItem', item.id, { before: beforeSnapshot, invoiceId: invoice.id }, req.ip).catch(() => {});
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// POST /:id/credit-note - Create credit note from invoice
router.post('/:id/credit-note', requireAuth, async (req, res, next) => {
  try {
    const { reason, items } = req.body;

    const invoice = await db.Invoice.findByPk(req.params.id, {
      include: [{ model: db.Customer, as: 'customer' }]
    });

    if (!invoice || invoice.deletedAt) throw new NotFoundError('Invoice not found');

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required for credit note');
    }

    // Calculate credit note totals
    let creditSubtotal = 0;
    let creditDiscount = 0;
    let creditTax = 0;

    for (const item of items) {
      const invoiceItem = await db.InvoiceItem.findByPk(item.invoiceItemId);
      if (invoiceItem) {
        const itemTotal = item.quantity * invoiceItem.unitPrice;
        creditSubtotal += itemTotal;
        creditDiscount += (invoiceItem.discount * item.quantity) / invoiceItem.quantity;
        creditTax += (invoiceItem.tax * item.quantity) / invoiceItem.quantity;
      }
    }

    const creditTotal = creditSubtotal - creditDiscount + creditTax;

    const creditNote = await db.Invoice.create({
      id: uuidv4(),
      invoiceNumber: generateDocumentNumber('CN'),
      customerId: invoice.customerId,
      type: 'credit_note',
      status: 'draft',
      subtotal: creditSubtotal,
      discount: creditDiscount,
      tax: creditTax,
      total: creditTotal,
      currency: invoice.currency,
      balance: creditTotal,
      notes: reason || 'Credit note'
    });

    // Add line items to credit note
    for (const item of items) {
      const invoiceItem = await db.InvoiceItem.findByPk(item.invoiceItemId);
      if (invoiceItem) {
        const itemTotal = item.quantity * invoiceItem.unitPrice - ((invoiceItem.discount * item.quantity) / invoiceItem.quantity) + ((invoiceItem.tax * item.quantity) / invoiceItem.quantity);

        await db.InvoiceItem.create({
          id: uuidv4(),
          invoiceId: creditNote.id,
          productId: invoiceItem.productId,
          description: invoiceItem.description,
          quantity: item.quantity,
          unit: invoiceItem.unit,
          unitPrice: invoiceItem.unitPrice,
          total: itemTotal,
          discount: (invoiceItem.discount * item.quantity) / invoiceItem.quantity,
          tax: (invoiceItem.tax * item.quantity) / invoiceItem.quantity
        });
      }
    }

    const result = await db.Invoice.findByPk(creditNote.id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { association: 'items', include: [{ model: db.Product, as: 'product' }] }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Credit note created'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Invoice', creditNote.id, { type: 'credit_note', sourceInvoiceId: invoice.id, data: result?.toJSON?.() || creditNote.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
