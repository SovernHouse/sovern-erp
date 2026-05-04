const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

const create = async (req, res, next) => {
  try {
    const { companyName, contactPerson, email, phone, address, city, country, currency, paymentTerms, creditLimit } = req.body;

    const existingCustomer = await db.Customer.findOne({ where: { email } });
    if (existingCustomer) {
      throw new ValidationError('Email already exists');
    }

    const customer = await db.Customer.create({
      id: uuidv4(),
      companyName,
      contactPerson,
      email,
      phone,
      address,
      city,
      country,
      currency: currency || 'USD',
      paymentTerms: paymentTerms || 'Net 30',
      creditLimit: creditLimit || 0,
      balance: 0,
      rating: 5,
      isActive: true
    });

    res.status(201).json(getSuccessResponse(customer, 'Customer created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Customer', customer.id, { data: customer.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (status) where.isActive = status === 'active';
    if (search) {
      where[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { contactPerson: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await db.Customer.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await db.Customer.findByPk(id, {
      include: [
        { association: 'inquiries', attributes: ['id', 'inquiryNumber', 'status'] },
        { association: 'quotations', attributes: ['id', 'quotationNumber', 'total'] },
        { association: 'salesOrders', attributes: ['id', 'orderNumber', 'status'] },
        { association: 'invoices', attributes: ['id', 'invoiceNumber', 'total', 'balance'] }
      ]
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    res.json(getSuccessResponse(customer));
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyName, contactPerson, email, phone, address, city, country, currency, paymentTerms, creditLimit, rating, isActive } = req.body;

    const customer = await db.Customer.findByPk(id);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const beforeSnapshot = customer.toJSON();

    await customer.update({
      companyName: companyName || customer.companyName,
      contactPerson: contactPerson !== undefined ? contactPerson : customer.contactPerson,
      email: email || customer.email,
      phone: phone || customer.phone,
      address: address !== undefined ? address : customer.address,
      city: city !== undefined ? city : customer.city,
      country: country !== undefined ? country : customer.country,
      currency: currency || customer.currency,
      paymentTerms: paymentTerms || customer.paymentTerms,
      creditLimit: creditLimit !== undefined ? creditLimit : customer.creditLimit,
      rating: rating !== undefined ? rating : customer.rating,
      isActive: isActive !== undefined ? isActive : customer.isActive
    });

    res.json(getSuccessResponse(customer, 'Customer updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Customer', id, { before: beforeSnapshot, after: customer.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const delete_ = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await db.Customer.findByPk(id);

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Check for active orders (not completed or cancelled)
    const { ValidationError } = require('../middleware/errorHandler');
    const activeOrders = await db.SalesOrder.findAll({
      where: {
        customerId: id,
        status: { [require('sequelize').Op.notIn]: ['completed', 'cancelled'] }
      },
      attributes: ['id', 'orderNumber', 'status']
    });

    if (activeOrders.length > 0) {
      throw new ValidationError(
        `Cannot delete customer with active orders. Found ${activeOrders.length} active order(s): ${activeOrders.map(o => o.orderNumber).join(', ')}`
      );
    }

    // Check for unpaid invoices
    const unpaidInvoices = await db.Invoice.findAll({
      where: {
        customerId: id,
        status: { [require('sequelize').Op.notIn]: ['paid', 'cancelled'] },
        deletedAt: null
      },
      attributes: ['id', 'invoiceNumber', 'status']
    });

    if (unpaidInvoices.length > 0) {
      throw new ValidationError(
        `Cannot delete customer with unpaid invoices. Found ${unpaidInvoices.length} unpaid invoice(s): ${unpaidInvoices.map(i => i.invoiceNumber).join(', ')}`
      );
    }

    await customer.update({ isActive: false });

    res.json(getSuccessResponse(null, 'Customer deactivated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Customer', id, { action: 'deactivated' }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getBalance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await db.Customer.findByPk(id);

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const invoices = await db.Invoice.findAll({
      where: { customerId: id, status: { [Op.ne]: 'cancelled' } }
    });

    const totalDue = invoices.reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0);
    const creditAvailable = Math.max(0, parseFloat(customer.creditLimit) - totalDue);

    res.json(getSuccessResponse({
      balance: customer.balance,
      creditLimit: customer.creditLimit,
      totalDue,
      creditAvailable,
      utilization: (totalDue / customer.creditLimit * 100).toFixed(2)
    }));
  } catch (error) {
    next(error);
  }
};

const getOrderHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    const customer = await db.Customer.findByPk(id);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // PERF: split count from data fetch.
    const [count, rows] = await Promise.all([
      db.SalesOrder.count({ where: { customerId: id } }),
      db.SalesOrder.findAll({
        where: { customerId: id },
        include: [
          { model: db.Factory, as: 'factory', attributes: ['companyName'] },
          { association: 'items', attributes: ['id', 'productId', 'quantity', 'total'] }
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

const getDashboard = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await db.Customer.findByPk(id);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const totalOrders = await db.SalesOrder.count({ where: { customerId: id } });
    const totalQuotations = await db.Quotation.count({ where: { customerId: id } });
    const pendingInvoices = await db.Invoice.count({ where: { customerId: id, status: 'unpaid' } });
    const totalSpent = await db.SalesOrder.sum('total', { where: { customerId: id } });

    const recentOrders = await db.SalesOrder.findAll({
      where: { customerId: id },
      limit: 5,
      order: [['createdAt', 'DESC']]
    });

    const recentInvoices = await db.Invoice.findAll({
      where: { customerId: id },
      limit: 5,
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse({
      customer,
      stats: {
        totalOrders,
        totalQuotations,
        pendingInvoices,
        totalSpent: totalSpent || 0,
        balance: customer.balance,
        creditAvailable: Math.max(0, customer.creditLimit - customer.balance)
      },
      recentOrders,
      recentInvoices
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
  getById,
  update,
  delete: delete_,
  getBalance,
  getOrderHistory,
  getDashboard
};
