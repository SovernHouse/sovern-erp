const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireAny } = require('../middleware/auth');
const { brandScope } = require('../middleware/brandScope');
const { getPagination, getPaginatedResponse, getSuccessResponse, generateDocumentNumber } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError } = require('../middleware/errorHandler');
const documentGenerator = require('../services/documentGenerator');
const emailService = require('../services/emailService');

// Phase 1 Commit 3b-B: brand-scope every proforma-invoice request.
router.use(requireAuth, brandScope);

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const { offset } = getPagination(page, limit);
    const where = { ...(req.brandScope?.where || {}) };
    if (status) where.status = status;

    const { count, rows } = await db.ProformaInvoice.findAndCountAll({
      where,
      include: [
        { model: db.Customer, as: 'customer', attributes: ['companyName'] },
        { model: db.Quotation, as: 'quotation', attributes: ['quotationNumber'] }
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
    const pi = await db.ProformaInvoice.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    if (!pi) throw new NotFoundError('Proforma Invoice not found');

    // Phase 3, C13: 404-on-wrong-brand.
    const { isAccessibleByBrandCode } = require('../utils/notFoundOnWrongBrand');
    if (!isAccessibleByBrandCode(req, pi.brandCode)) {
      throw new NotFoundError('Proforma Invoice not found');
    }

    res.json(getSuccessResponse(pi));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /:id/convert-order
 * Confirm a PI and create a Sales Order from it.
 *
 * Body: { factoryId (required), estimatedDelivery? (ISO date) }
 *
 * Fixed bugs vs previous PATCH /:id/confirm:
 *   - factoryId now comes from request body (previously tried to derive from
 *     pi.quotation.inquiryId which (a) the PI query didn't include and
 *     (b) would have stored the inquiry ID not the factory ID anyway)
 *   - Wrapped in a transaction so a DB failure won't leave PI confirmed
 *     without a corresponding SO
 *   - Uses generateDocumentNumber for a readable, unique SO number instead
 *     of the raw Date.now() timestamp
 *   - Returns the created SO so the frontend can navigate to it
 */
router.post('/:id/convert-order', requireAuth, async (req, res, next) => {
  const { factoryId, estimatedDelivery } = req.body;

  if (!factoryId) {
    return res.status(400).json({ success: false, message: 'factoryId is required to convert a PI to a Sales Order' });
  }

  const t = await db.sequelize.transaction();
  try {
    const pi = await db.ProformaInvoice.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ],
      transaction: t,
    });

    if (!pi) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Proforma Invoice not found' });
    }

    if (pi.status === 'converted') {
      await t.rollback();
      return res.status(409).json({ success: false, message: 'This PI has already been converted to a Sales Order' });
    }

    // Validate the factory exists
    const factory = await db.Factory.findByPk(factoryId, { transaction: t });
    if (!factory) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Factory not found' });
    }

    // Mark PI as converted
    await pi.update({ status: 'converted' }, { transaction: t });

    // Create the Sales Order
    const salesOrder = await db.SalesOrder.create({
      id: uuidv4(),
      orderNumber: generateDocumentNumber('SO'),
      proformaInvoiceId: pi.id,
      customerId: pi.customerId,
      factoryId,
      status: 'confirmed',
      subtotal: pi.subtotal,
      discount: pi.discount,
      tax: pi.tax,
      total: pi.total,
      currency: pi.currency,
      estimatedDelivery: estimatedDelivery || null,
    }, { transaction: t });

    // Copy line items from PI to SO
    for (const item of (pi.items || [])) {
      await db.SalesOrderItem.create({
        id: uuidv4(),
        salesOrderId: salesOrder.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
      }, { transaction: t });
    }

    await t.commit();

    res.json(getSuccessResponse(
      { pi, salesOrder: { id: salesOrder.id, orderNumber: salesOrder.orderNumber } },
      'Proforma Invoice confirmed and Sales Order created'
    ));
  } catch (error) {
    await t.rollback();
    next(error);
  }
});

/**
 * POST /:id/confirm — Phase 4.25b.
 *
 * Transitions PI to status='confirmed' AND auto-creates a SalesOrder
 * via workflowService. International-trade chain step 2 (Quote ->
 * Proforma -> SO; this endpoint is the Proforma -> SO hop).
 *
 * Body: { factoryId?, estimatedDelivery? } (both optional)
 *   - factoryId: explicit factory for the SO. If omitted, the workflow
 *     derives it from the first line item Product.factoryId.
 *   - estimatedDelivery: ISO date string, optional.
 *
 * Idempotent: re-hitting this endpoint after a SO exists returns the
 * existing SO and does not create a duplicate. The PI status update is
 * also idempotent (already-confirmed stays confirmed).
 *
 * Best-effort failure: if the auto-create fails (e.g. no factoryId can
 * be resolved), the response surfaces an error but the PI status DOES
 * NOT roll back. Caller can re-trigger with an explicit factoryId.
 *
 * Differs from the older /convert-order endpoint: that one required
 * factoryId, set an invalid status='converted' (not in the enum), and
 * lacked workflow integration. /convert-order is preserved for back
 * compat but new code should call /confirm.
 */
router.post('/:id/confirm', requireAuth, async (req, res, next) => {
  try {
    const { factoryId, estimatedDelivery } = req.body || {};

    const pi = await db.ProformaInvoice.findByPk(req.params.id);
    if (!pi) throw new NotFoundError('Proforma Invoice not found');

    const { isAccessibleByBrandCode } = require('../utils/notFoundOnWrongBrand');
    if (!isAccessibleByBrandCode(req, pi.brandCode)) {
      throw new NotFoundError('Proforma Invoice not found');
    }

    const beforeStatus = pi.status;
    if (pi.status !== 'confirmed') {
      await pi.update({ status: 'confirmed' });
    }

    // Phase 4.25b: PI.confirm -> SalesOrder auto-chain.
    let chainResult;
    try {
      const workflowService = require('../services/workflowService');
      chainResult = await workflowService.onProformaInvoiceConfirmed(pi, {
        userId: req.user && req.user.id,
        ip: req.ip,
        source: 'rest_confirm',
        factoryId,
        estimatedDelivery,
      });
    } catch (chainErr) {
      const auditService = require('../services/auditService');
      auditService.logAction(
        (req.user && req.user.id) || null,
        'auto_create_failed',
        'ProformaInvoice',
        pi.id,
        { error: chainErr && chainErr.message, chainStep: 'onProformaInvoiceConfirmed', phase: '4.25b' },
        req.ip || null,
      ).catch(() => {});
      return res.json(getSuccessResponse(
        { proformaInvoice: pi, salesOrder: null, autoChainError: chainErr.message },
        'Proforma Invoice confirmed; SalesOrder auto-create failed (see audit log)'
      ));
    }

    if (!chainResult.ok) {
      const auditService = require('../services/auditService');
      auditService.logAction(
        (req.user && req.user.id) || null,
        'auto_create_failed',
        'ProformaInvoice',
        pi.id,
        { code: chainResult.code, message: chainResult.message, chainStep: 'onProformaInvoiceConfirmed', phase: '4.25b' },
        req.ip || null,
      ).catch(() => {});
      return res.json(getSuccessResponse(
        { proformaInvoice: pi, salesOrder: null, autoChainError: chainResult.message },
        'Proforma Invoice confirmed; SalesOrder auto-create skipped'
      ));
    }

    // Fire-and-forget status-change audit (matches the pattern used by
    // quotationController.accept and the rest of the suite).
    const auditService = require('../services/auditService');
    auditService.logAction(req.user.id, 'UPDATE', 'ProformaInvoice', pi.id,
      { statusChange: { before: beforeStatus, after: 'confirmed' } },
      req.ip).catch(() => {});

    // Phase 4.25c: SalesOrder.confirm -> PurchaseOrder(s) per factory.
    // The SO is born with status='confirmed' (model default), so the
    // chain continues immediately. Best-effort: PO auto-create failure
    // logs an audit row but does NOT roll back the upstream PI or SO.
    let poChainResult = null;
    try {
      const workflowService = require('../services/workflowService');
      poChainResult = await workflowService.onSalesOrderConfirmed(chainResult.salesOrder, {
        userId: req.user && req.user.id,
        ip: req.ip,
        source: 'rest_confirm_cascade',
      });
    } catch (poErr) {
      auditService.logAction(
        (req.user && req.user.id) || null,
        'auto_create_failed',
        'SalesOrder',
        chainResult.salesOrder.id,
        { error: poErr && poErr.message, chainStep: 'onSalesOrderConfirmed', phase: '4.25c' },
        req.ip || null,
      ).catch(() => {});
    }

    res.json(getSuccessResponse({
      proformaInvoice: pi,
      salesOrder: chainResult.salesOrder,
      autoChainCreated: !chainResult.alreadyExisted,
      purchaseOrders: poChainResult && poChainResult.ok ? {
        created: poChainResult.created.map(po => ({ id: po.id, poNumber: po.poNumber, factoryId: po.factoryId })),
        alreadyExisted: poChainResult.alreadyExisted.map(po => ({ id: po.id, poNumber: po.poNumber, factoryId: po.factoryId })),
        skipped: poChainResult.skipped,
      } : null,
    }, chainResult.alreadyExisted
      ? 'Proforma Invoice confirmed (SalesOrder already existed)'
      : 'Proforma Invoice confirmed; SalesOrder + PurchaseOrder(s) auto-created'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/send', requireAuth, async (req, res, next) => {
  try {
    const pi = await db.ProformaInvoice.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    if (!pi) throw new NotFoundError('Proforma Invoice not found');

    // Phase 4, C16: FW PIs are internal records — the factory sends the
    // document to the buyer directly. Defense-in-depth alongside the
    // disabled Send button in the UI.
    if (pi.brandCode === 'FW') {
      const auditService = require('../services/auditService');
      auditService.logAction(req.user.id, 'fw_send_blocked', 'ProformaInvoice', pi.id, {
        attemptedBy: req.user.email || req.user.id,
        piNumber: pi.piNumber,
      }, req.ip).catch(() => {});
      return res.status(400).json({
        success: false,
        message: 'FlorWay proforma invoices are internal records; the factory sends the document to the buyer. Auto-send is disabled.',
      });
    }

    const pdfFile = await documentGenerator.generateProformaInvoicePDF(pi, pi.items, pi.customer);
    await emailService.sendProformaInvoiceEmail(pi.customer, pi);

    await pi.update({ status: 'sent' });

    res.json(getSuccessResponse({ pdfFile }, 'PI sent successfully'));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/pdf', requireAuth, async (req, res, next) => {
  try {
    const pi = await db.ProformaInvoice.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    if (!pi) throw new NotFoundError('Proforma Invoice not found');

    const pdfFile = await documentGenerator.generateProformaInvoicePDF(pi, pi.items, pi.customer);
    res.json(getSuccessResponse({ pdfFile }, 'PDF generated'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
