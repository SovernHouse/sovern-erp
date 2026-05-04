const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError } = require('../middleware/errorHandler');
const documentGenerator = require('../services/documentGenerator');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const { generateNumberWithCounter, incrementCounter } = require('../services/numberGenerator');
const auditService = require('../services/auditService');
const { validateFinancials } = require('../utils/validateFinancials');

const create = async (req, res, next) => {
  try {
    validateFinancials(req.body);
    const { customerId, inquiryId, salesPersonId, items, discount, discountType, taxRate, terms } = req.body;

    const customer = await db.Customer.findByPk(customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const lastQuotation = await db.Quotation.findOne({
      order: [['createdAt', 'DESC']]
    });

    const counter = incrementCounter(lastQuotation?.quotationNumber);
    const quotationNumber = generateNumberWithCounter(process.env.DOC_PREFIX_QUOTATION || 'QOT', counter);

    let subtotal = 0;
    const createdItems = [];

    for (const item of items) {
      const product = await db.Product.findByPk(item.productId);
      if (!product) continue;

      const total = item.quantity * item.unitPrice;
      subtotal += total;

      createdItems.push({
        id: uuidv4(),
        productId: item.productId,
        description: item.description || product.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        total,
        notes: item.notes || ''
      });
    }

    const discountAmount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
    const afterDiscount = subtotal - discountAmount;
    const tax = (afterDiscount * taxRate) / 100;
    const total = afterDiscount + tax;

    const quotation = await db.Quotation.create({
      id: uuidv4(),
      quotationNumber,
      inquiryId: inquiryId || null,
      customerId,
      salesPersonId: salesPersonId || null,
      status: 'draft',
      subtotal,
      discount: discountAmount,
      discountType: discountType || 'fixed',
      tax,
      taxRate: taxRate || 0,
      total,
      currency: customer.currency || 'USD',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      terms
    });

    await Promise.all(createdItems.map(item =>
      db.QuotationItem.create({ ...item, quotationId: quotation.id })
    ));

    const result = await db.Quotation.findByPk(quotation.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.User, as: 'salesPerson' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Quotation created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Quotation', quotation.id, { data: result?.toJSON?.() || quotation.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, customerId } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { deletedAt: null };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (search) where.quotationNumber = { [Op.like]: `%${search}%` };

    const [count, rows] = await Promise.all([
      db.Quotation.count({ where }),
      db.Quotation.findAll({
        where,
        include: [
          { model: db.Customer, as: 'customer', attributes: ['companyName'] },
          { model: db.User, as: 'salesPerson', attributes: ['firstName', 'lastName'] }
        ],
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.User, as: 'salesPerson' },
        { model: db.Inquiry, as: 'inquiry' }
      ]
    });

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    res.json(getSuccessResponse(quotation));
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items, discount, taxRate, terms, validUntil } = req.body;

    const quotation = await db.Quotation.findByPk(id);
    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    if (quotation.status !== 'draft') {
      throw new Error('Can only edit draft quotations');
    }

    const beforeSnapshot = quotation.toJSON();

    if (items) {
      let subtotal = 0;
      for (const item of items) {
        const total = item.quantity * item.unitPrice;
        subtotal += total;

        if (item.id) {
          await db.QuotationItem.update(item, { where: { id: item.id } });
        } else {
          await db.QuotationItem.create({
            id: uuidv4(),
            quotationId: id,
            ...item
          });
        }
      }

      const discountAmount = quotation.discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
      const tax = ((subtotal - discountAmount) * taxRate) / 100;
      const total = subtotal - discountAmount + tax;

      await quotation.update({
        subtotal,
        discount: discountAmount,
        tax,
        taxRate: taxRate || quotation.taxRate,
        total,
        terms,
        validUntil
      });
    }

    const result = await db.Quotation.findByPk(id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.json(getSuccessResponse(result, 'Quotation updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Quotation', id, { before: beforeSnapshot, after: result?.toJSON?.() || quotation.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const send = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.User, as: 'salesPerson' }
      ]
    });

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const pdfFile = await documentGenerator.generateQuotationPDF(
      quotation,
      quotation.items,
      quotation.customer,
      quotation.salesPerson
    );

    await emailService.sendQuotationEmail(quotation.customer, quotation);

    const beforeStatus = quotation.status;
    await quotation.update({ status: 'sent' });

    await notificationService.createQuotationNotification(quotation, quotation.customer.id, 'sent');

    res.json(getSuccessResponse({ quotation, pdfFile }, 'Quotation sent successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Quotation', id, { statusChange: { before: beforeStatus, after: 'sent' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const accept = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id);

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const beforeStatus = quotation.status;
    await quotation.update({ status: 'accepted' });
    await notificationService.createQuotationNotification(quotation, quotation.customerId, 'accepted');

    res.json(getSuccessResponse(quotation, 'Quotation accepted'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Quotation', id, { statusChange: { before: beforeStatus, after: 'accepted' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const reject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id);

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const beforeStatus = quotation.status;
    await quotation.update({ status: 'rejected' });
    await notificationService.createQuotationNotification(quotation, quotation.customerId, 'rejected');

    res.json(getSuccessResponse(quotation, 'Quotation rejected'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Quotation', id, { statusChange: { before: beforeStatus, after: 'rejected' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const duplicate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const original = await db.Quotation.findByPk(id, {
      include: [{ association: 'items' }]
    });

    if (!original || original.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const lastQuotation = await db.Quotation.findOne({
      order: [['createdAt', 'DESC']]
    });

    const counter = incrementCounter(lastQuotation?.quotationNumber);
    const quotationNumber = generateNumberWithCounter(process.env.DOC_PREFIX_QUOTATION || 'QOT', counter);

    const newQuotation = await db.Quotation.create({
      ...original.toJSON(),
      id: uuidv4(),
      quotationNumber,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    for (const item of original.items) {
      await db.QuotationItem.create({
        ...item.toJSON(),
        id: uuidv4(),
        quotationId: newQuotation.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    const result = await db.Quotation.findByPk(newQuotation.id, {
      include: [{ association: 'items' }]
    });

    res.status(201).json(getSuccessResponse(result, 'Quotation duplicated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Quotation', newQuotation.id, { data: result?.toJSON?.() || newQuotation.toJSON(), sourceQuotationId: id }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const convertToProformaInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentTerms } = req.body;

    const quotation = await db.Quotation.findByPk(id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const lastPI = await db.ProformaInvoice.findOne({
      order: [['createdAt', 'DESC']]
    });

    const counter = incrementCounter(lastPI?.piNumber);
    const piNumber = generateNumberWithCounter(process.env.DOC_PREFIX_PI || 'PI', counter);

    const pi = await db.ProformaInvoice.create({
      id: uuidv4(),
      piNumber,
      quotationId: id,
      customerId: quotation.customerId,
      status: 'draft',
      subtotal: quotation.subtotal,
      discount: quotation.discount,
      tax: quotation.tax,
      total: quotation.total,
      currency: quotation.currency,
      paymentTerms: paymentTerms || 'Net 30',
      validUntil: quotation.validUntil
    });

    for (const item of quotation.items) {
      await db.ProformaInvoiceItem.create({
        id: uuidv4(),
        proformaInvoiceId: pi.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total
      });
    }

    const result = await db.ProformaInvoice.findByPk(pi.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Proforma Invoice created from quotation'));
  } catch (error) {
    next(error);
  }
};

const generatePDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.User, as: 'salesPerson' }
      ]
    });

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const pdfFile = await documentGenerator.generateQuotationPDF(
      quotation,
      quotation.items,
      quotation.customer,
      quotation.salesPerson
    );

    res.json(getSuccessResponse({ pdfFile }, 'PDF generated successfully'));
  } catch (error) {
    next(error);
  }
};

const softDelete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id);

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const beforeSnapshot = quotation.toJSON();

    await quotation.update({ deletedAt: new Date() });

    res.json(getSuccessResponse({ id: quotation.id }, 'Quotation deleted'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Quotation', id, { before: beforeSnapshot }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
  getById,
  update,
  send,
  accept,
  reject,
  duplicate,
  convertToProformaInvoice,
  generatePDF,
  softDelete
};
