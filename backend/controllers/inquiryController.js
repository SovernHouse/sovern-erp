const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse, generateDocumentNumber } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const { generateNumberWithCounter, incrementCounter } = require('../services/numberGenerator');

const create = async (req, res, next) => {
  try {
    const { customerId, salesPersonId, source, priority, notes, estimatedValue, items } = req.body;

    const customer = await db.Customer.findByPk(customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const lastInquiry = await db.Inquiry.findOne({
      where: { inquiryNumber: { [Op.like]: `${process.env.DOC_PREFIX_INQUIRY}-${new Date().getFullYear()}%` } },
      order: [['createdAt', 'DESC']]
    });

    const counter = incrementCounter(lastInquiry?.inquiryNumber);
    const inquiryNumber = generateNumberWithCounter(process.env.DOC_PREFIX_INQUIRY || 'INQ', counter);

    const inquiry = await db.Inquiry.create({
      id: uuidv4(),
      inquiryNumber,
      customerId,
      salesPersonId: salesPersonId || null,
      source: source || 'email',
      priority: priority || 'medium',
      status: 'new',
      notes: notes || '',
      estimatedValue: estimatedValue || 0
    });

    if (items && Array.isArray(items)) {
      await Promise.all(items.map(item =>
        db.InquiryItem.create({
          id: uuidv4(),
          inquiryId: inquiry.id,
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit || 'sqm',
          targetPrice: item.targetPrice || null,
          notes: item.notes || '',
          specifications: item.specifications || {}
        })
      ));
    }

    if (salesPersonId) {
      await notificationService.createInquiryNotification(inquiry, 'created');
      // Fire-and-forget real-time notification
      notificationService.emitNewInquiry(inquiry.id, salesPersonId).catch(() => {});
    }

    const inquiryWithItems = await db.Inquiry.findByPk(inquiry.id, {
      include: [{ association: 'items', include: [{ model: db.Product, as: 'product' }] }]
    });

    res.status(201).json(getSuccessResponse(inquiryWithItems, 'Inquiry created successfully'));
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, priority, customerId } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { ...(req.brandScope?.where || {}) };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (customerId) where.customerId = customerId;
    if (search) {
      where[Op.or] = [
        { inquiryNumber: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } }
      ];
    }

    // PERF: split count from data fetch.
    const [count, rows] = await Promise.all([
      db.Inquiry.count({ where }),
      db.Inquiry.findAll({
        where,
        include: [
          { model: db.Customer, as: 'customer', attributes: ['companyName'] },
          { model: db.User, as: 'salesPerson', attributes: ['firstName', 'lastName'] },
          { association: 'items', attributes: ['id', 'productId', 'quantity'] }
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
    const inquiry = await db.Inquiry.findByPk(id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.User, as: 'salesPerson' },
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { association: 'quotations', attributes: ['id', 'quotationNumber', 'status'] }
      ]
    });

    if (!inquiry) {
      throw new NotFoundError('Inquiry not found');
    }

    res.json(getSuccessResponse(inquiry));
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const inquiry = await db.Inquiry.findByPk(id);
    if (!inquiry) {
      throw new NotFoundError('Inquiry not found');
    }

    await inquiry.update({
      status,
      notes: notes || inquiry.notes
    });

    await notificationService.createInquiryNotification(inquiry, 'status_changed');

    res.json(getSuccessResponse(inquiry, 'Inquiry status updated'));
  } catch (error) {
    next(error);
  }
};

const followUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { followUpDate, notes } = req.body;

    const inquiry = await db.Inquiry.findByPk(id);
    if (!inquiry) {
      throw new NotFoundError('Inquiry not found');
    }

    await inquiry.update({
      followUpDate: new Date(followUpDate),
      notes: notes || inquiry.notes
    });

    res.json(getSuccessResponse(inquiry, 'Follow-up scheduled'));
  } catch (error) {
    next(error);
  }
};

const convertToQuotation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { salesPersonId, discount, taxRate, terms } = req.body;

    const inquiry = await db.Inquiry.findByPk(id, {
      include: [{ association: 'items', include: [{ model: db.Product, as: 'product', include: [{ model: db.ProductPrice, as: 'prices' }] }] }]
    });

    if (!inquiry) {
      throw new NotFoundError('Inquiry not found');
    }

    const lastQuotation = await db.Quotation.findOne({
      order: [['createdAt', 'DESC']]
    });

    const counter = incrementCounter(lastQuotation?.quotationNumber);
    const quotationNumber = generateNumberWithCounter(process.env.DOC_PREFIX_QUOTATION || 'QOT', counter);

    let subtotal = 0;
    const quotationItems = [];

    for (const item of inquiry.items) {
      const product = item.product;
      const price = product.prices?.find(p => p.isActive && new Date() >= p.validFrom && (!p.validTo || new Date() <= p.validTo));
      const unitPrice = price?.sellingPrice || item.targetPrice || 0;
      const total = item.quantity * unitPrice;

      subtotal += total;
      quotationItems.push({
        id: uuidv4(),
        productId: item.productId,
        description: product.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice,
        discount: 0,
        total
      });
    }

    const discountAmount = discount ? (discount / 100) * subtotal : 0;
    const afterDiscount = subtotal - discountAmount;
    const tax = (afterDiscount * (taxRate || 0)) / 100;
    const total = afterDiscount + tax;

    const quotation = await db.Quotation.create({
      id: uuidv4(),
      quotationNumber,
      inquiryId: id,
      customerId: inquiry.customerId,
      salesPersonId: salesPersonId || inquiry.salesPersonId,
      status: 'draft',
      subtotal,
      discount: discountAmount,
      discountType: 'fixed',
      tax,
      taxRate: taxRate || 0,
      total,
      currency: inquiry.customer?.currency || 'USD',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      terms
    });

    await Promise.all(quotationItems.map(item =>
      db.QuotationItem.create({ ...item, quotationId: quotation.id })
    ));

    await inquiry.update({
      status: 'quoted',
      convertedToQuotationId: quotation.id
    });

    const result = await db.Quotation.findByPk(quotation.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Quotation created from inquiry'));
  } catch (error) {
    next(error);
  }
};

const getTimeline = async (req, res, next) => {
  try {
    const { id } = req.params;

    const inquiry = await db.Inquiry.findByPk(id);
    if (!inquiry) {
      throw new NotFoundError('Inquiry not found');
    }

    const timeline = [];
    timeline.push({ date: inquiry.createdAt, action: 'Inquiry created', status: 'created' });

    if (inquiry.updatedAt !== inquiry.createdAt) {
      timeline.push({ date: inquiry.updatedAt, action: 'Inquiry updated', status: inquiry.status });
    }

    if (inquiry.followUpDate) {
      timeline.push({ date: inquiry.followUpDate, action: 'Follow-up scheduled', status: 'follow_up' });
    }

    if (inquiry.convertedToQuotationId) {
      const quotation = await db.Quotation.findByPk(inquiry.convertedToQuotationId);
      timeline.push({ date: quotation.createdAt, action: 'Converted to quotation', status: 'converted' });
    }

    res.json(getSuccessResponse(timeline.sort((a, b) => new Date(a.date) - new Date(b.date))));
  } catch (error) {
    next(error);
  }
};

const delete_ = async (req, res, next) => {
  try {
    const { id } = req.params;
    const inquiry = await db.Inquiry.findByPk(id);
    if (!inquiry) throw new NotFoundError('Inquiry not found');

    if (inquiry.convertedToQuotationId) {
      throw new ValidationError(
        'Cannot delete an inquiry that was converted to a quotation. Delete the quotation first or keep this for the audit trail.'
      );
    }

    await inquiry.destroy();
    res.json(getSuccessResponse({ id }, 'Inquiry deleted successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
  getById,
  updateStatus,
  followUp,
  convertToQuotation,
  getTimeline,
  delete: delete_,
};
