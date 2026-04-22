const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireAny } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError } = require('../middleware/errorHandler');
const documentGenerator = require('../services/documentGenerator');
const emailService = require('../services/emailService');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const { offset } = getPagination(page, limit);
    const where = status ? { status } : {};

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
    res.json(getSuccessResponse(pi));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/confirm', requireAuth, async (req, res, next) => {
  try {
    const pi = await db.ProformaInvoice.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    if (!pi) throw new NotFoundError('Proforma Invoice not found');

    await pi.update({ status: 'confirmed' });

    const salesOrder = await db.SalesOrder.create({
      id: uuidv4(),
      orderNumber: `SO-${Date.now()}`,
      proformaInvoiceId: pi.id,
      customerId: pi.customerId,
      factoryId: pi.quotation.inquiryId ?
        (await db.Inquiry.findByPk(pi.quotation.inquiryId))?.id : null,
      status: 'confirmed',
      subtotal: pi.subtotal,
      discount: pi.discount,
      tax: pi.tax,
      total: pi.total,
      currency: pi.currency
    });

    for (const item of pi.items) {
      await db.SalesOrderItem.create({
        id: uuidv4(),
        salesOrderId: salesOrder.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total
      });
    }

    res.json(getSuccessResponse(pi, 'Proforma Invoice confirmed and Sales Order created'));
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
