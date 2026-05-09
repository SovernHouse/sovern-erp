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

    // Check for quotations
    const openQuotations = await db.Quotation.count({
      where: { customerId: id, status: { [require('sequelize').Op.notIn]: ['accepted', 'rejected'] } }
    });
    if (openQuotations > 0) {
      throw new ValidationError(
        `Cannot delete customer with ${openQuotations} open quotation(s). Close them first.`
      );
    }

    // Customer model is paranoid — destroy() sets deletedAt, and the
    // default findAll filters out deletedAt records. The previous
    // update({isActive:false}) left the row visible in lists because
    // getAll does not filter on isActive.
    const beforeSnapshot = customer.toJSON();
    await customer.destroy();

    res.json(getSuccessResponse(null, 'Customer deleted successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Customer', id, { before: beforeSnapshot }, req.ip).catch(() => {});
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

// ── Customer profitability (item 4e) ────────────────────────────────────────
// GET /api/customers/:id/profitability?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns the per-customer P&L Alex needs to see real margin after costs.
// Default period: trailing 12 months (so the dashboard can render without
// the user picking dates first).
//
// Allocation policy (per spec DECIDE 4B = option A):
//   - Direct expenses: Expense rows with customerId = X.
//   - Allocated overhead: Expenses with customerId IS NULL ("general
//     business" — rent, salary, software), allocated to this customer in
//     proportion to its share of period revenue. So if X is 30% of period
//     revenue, X absorbs 30% of overhead.
//   - directCostRatio = directExpenses / revenue (extra column for the UI).
//     Lets you spot high-touch low-margin clients regardless of overhead
//     allocation choice.
//
// All amounts in USD. Expense rows use usdAmount when set; falls back to
// originalAmount only when originalCurrency = 'USD' (so totals don't get
// inflated by mixing currencies).
const getProfitability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await db.Customer.findByPk(id);
    if (!customer) throw new NotFoundError('Customer not found');

    const now = new Date();
    const defaultFrom = new Date(now); defaultFrom.setMonth(defaultFrom.getMonth() - 12);
    const from = req.query.from ? new Date(req.query.from) : defaultFrom;
    const to   = req.query.to   ? new Date(req.query.to)   : now;
    const fromIso = from.toISOString().slice(0, 10);
    const toIso   = to.toISOString().slice(0, 10);

    // ─── Revenue: Invoice rows for this customer in the period ───────────────
    let invoicedTotal = 0;
    let paidTotal = 0;
    if (db.Invoice) {
      const invoices = await db.Invoice.findAll({
        where: {
          customerId: id,
          createdAt: { [Op.between]: [from, to] },
        },
        attributes: ['id', 'totalAmount', 'paidAmount', 'currency', 'status'],
      });
      for (const inv of invoices) {
        // Invoice totals are stored in the customer's currency typically; for
        // the v1 P&L we treat all numerics as USD-equivalent (most Sovern
        // invoices are USD anyway). A fuller version would convert via
        // ExchangeRate using each invoice's currency + invoice date.
        invoicedTotal += Number(inv.totalAmount) || 0;
        paidTotal     += Number(inv.paidAmount)  || 0;
      }
    }

    // ─── COGS: PurchaseOrder costs for this customer's SalesOrders ────────────
    let cogsTotal = 0;
    if (db.PurchaseOrder && db.SalesOrder) {
      const salesOrders = await db.SalesOrder.findAll({
        where: { customerId: id, createdAt: { [Op.between]: [from, to] } },
        attributes: ['id'],
      });
      const soIds = salesOrders.map(so => so.id);
      if (soIds.length > 0) {
        const pos = await db.PurchaseOrder.findAll({
          where: { salesOrderId: { [Op.in]: soIds } },
          attributes: ['id', 'totalAmount', 'currency'],
        });
        for (const po of pos) cogsTotal += Number(po.totalAmount) || 0;
      }
    }

    // ─── Direct expenses: Expense rows with customerId = X ──────────────────
    const directExpenseRows = await db.Expense.findAll({
      where: {
        customerId: id,
        entryDate: { [Op.between]: [fromIso, toIso] },
      },
      attributes: ['id', 'usdAmount', 'originalAmount', 'originalCurrency'],
    });
    const directExpensesTotal = directExpenseRows.reduce((sum, e) => {
      if (e.usdAmount != null) return sum + Number(e.usdAmount);
      if ((e.originalCurrency || '').toUpperCase() === 'USD') return sum + Number(e.originalAmount || 0);
      return sum; // skip rows with no usdAmount + non-USD currency to avoid mixing
    }, 0);

    // ─── Allocated overhead: unattributed Expense rows × this client's revenue share ─
    const overheadRows = await db.Expense.findAll({
      where: {
        customerId: null,
        factoryId: null,
        entryDate: { [Op.between]: [fromIso, toIso] },
      },
      attributes: ['id', 'usdAmount', 'originalAmount', 'originalCurrency'],
    });
    const overheadTotal = overheadRows.reduce((sum, e) => {
      if (e.usdAmount != null) return sum + Number(e.usdAmount);
      if ((e.originalCurrency || '').toUpperCase() === 'USD') return sum + Number(e.originalAmount || 0);
      return sum;
    }, 0);

    // Total revenue across all customers in the period (denominator for share)
    let totalPeriodRevenue = invoicedTotal;
    if (db.Invoice) {
      const allInvoices = await db.Invoice.findAll({
        where: { createdAt: { [Op.between]: [from, to] } },
        attributes: ['totalAmount'],
      });
      totalPeriodRevenue = allInvoices.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
    }
    const revenueShare = totalPeriodRevenue > 0 ? invoicedTotal / totalPeriodRevenue : 0;
    const allocatedOverhead = overheadTotal * revenueShare;

    // ─── Aggregates ─────────────────────────────────────────────────────────
    const grossProfit = invoicedTotal - cogsTotal;
    const netProfit   = grossProfit - directExpensesTotal - allocatedOverhead;
    const directCostRatio = invoicedTotal > 0 ? directExpensesTotal / invoicedTotal : null;

    return res.json(getSuccessResponse({
      customer: {
        id: customer.id,
        companyName: customer.companyName,
        country: customer.country,
      },
      period: { from: fromIso, to: toIso },
      currency: 'USD',
      revenue: {
        invoiced: round2(invoicedTotal),
        paid:     round2(paidTotal),
      },
      cogs: round2(cogsTotal),
      directExpenses: {
        total: round2(directExpensesTotal),
        count: directExpenseRows.length,
      },
      allocatedOverhead: {
        total:        round2(allocatedOverhead),
        basis:        'revenue_share',
        revenueShare: round4(revenueShare),
        overheadPool: round2(overheadTotal),
      },
      grossProfit: round2(grossProfit),
      netProfit:   round2(netProfit),
      // Per DECIDE 4B: surface the high-touch signal alongside the
      // allocation-based net so the user can spot expensive clients
      // independent of allocation method.
      directCostRatio: directCostRatio != null ? round4(directCostRatio) : null,
    }));
  } catch (err) {
    next(err);
  }
};

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function round4(n) { return Math.round((Number(n) || 0) * 10000) / 10000; }

module.exports = {
  create,
  getAll,
  getById,
  update,
  delete: delete_,
  getBalance,
  getOrderHistory,
  getDashboard,
  getProfitability,
};
