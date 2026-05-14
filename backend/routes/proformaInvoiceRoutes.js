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

router.post('/:id/send', requireAuth, async (req, res, next) => {
  try {
    const pi = await db.ProformaInvoice.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    if (!pi) throw new NotFoundError('Proforma Invoice not found');

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
