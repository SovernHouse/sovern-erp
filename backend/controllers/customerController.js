const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

const create = async (req, res, next) => {
  try {
    const { companyName, contactPerson, email, phone, address, city, country, currency, paymentTerms, creditLimit, brandRelationships } = req.body;

    const existingCustomer = await db.Customer.findOne({ where: { email } });
    if (existingCustomer) {
      throw new ValidationError('Email already exists');
    }

    // Phase 1 Commit 3b-B: brandRelationships defaults to the user's
    // defaultBrand so customers created from an FW session start as FW-only.
    // Caller-supplied array wins if provided.
    const brands = Array.isArray(brandRelationships) && brandRelationships.length
      ? brandRelationships
      : [req.brandScope?.defaultBrand || 'SH'];

    // Phase 4, C18: synchronous sanctions screen at create time.
    // Flagged customers are created with screeningStatus='flagged' +
    // isActive=false so they exist for super-admin review but cannot be
    // transacted against. Response is 403 with the block details.
    const sanctionsService = require('../services/sanctionsService');
    const screen = sanctionsService.screenName(companyName, country);

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
      isActive: screen.status !== 'flagged',
      brandRelationships: brands,
      screeningStatus: screen.status,
      sanctionsScreenDetails: screen.hits,
      lastScreenedAt: new Date(),
      sanctionBlockReason: screen.status === 'flagged'
        ? `Matched on ${screen.hits.map((h) => h.list).join(', ')}`
        : null,
    });

    if (screen.status === 'flagged') {
      auditService.logAction(
        req.user.id,
        'sanctions_block',
        'Customer',
        customer.id,
        { companyName, country, hits: screen.hits },
        req.ip,
      ).catch(() => {});
      return res.status(403).json({
        success: false,
        message: `Customer "${companyName}" matched a sanctions list (${screen.hits.map((h) => h.list).join(', ')}). The record was created as inactive; super-admin override required to transact.`,
        sanctionsBlock: { status: screen.status, hits: screen.hits, customerId: customer.id },
      });
    }

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

    // Phase 1 Commit 3b-B: brand isolation. Customer.brandRelationships is a
    // JSON array; SQLite has no rich Op.contains so we filter at the app
    // layer. Cross-brand mode (super_admin All Brands tab) skips the filter.
    const scope = req.brandScope;
    const filterByBrand = scope && !scope.isCrossBrand;

    // Pull a generous over-fetch so post-filtering still respects the page size.
    const rawLimit = filterByBrand ? Math.max(parseInt(limit) * 4, 200) : parseInt(limit);
    const rawOffset = filterByBrand ? 0 : offset; // app-filter forces full scan from page 1

    let { count, rows } = await db.Customer.findAndCountAll({
      where,
      offset: rawOffset,
      limit: rawLimit,
      order: [['createdAt', 'DESC']]
    });

    if (filterByBrand) {
      const allowed = new Set(scope.accessibleBrands);
      rows = rows.filter((c) => {
        const rels = Array.isArray(c.brandRelationships) ? c.brandRelationships : ['SH'];
        return rels.some((r) => allowed.has(r));
      });
      count = rows.length; // best-effort; honest count requires a second pass
      rows = rows.slice(offset, offset + parseInt(limit));
    }

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

    // Phase 3, C13: 404-on-wrong-brand. Customer uses the JSON array
    // brandRelationships pattern.
    const { isAccessibleByBrandRelationships } = require('../utils/notFoundOnWrongBrand');
    if (!isAccessibleByBrandRelationships(req, customer.brandRelationships)) {
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
    const {
      companyName, contactPerson, email, phone, address, city, country,
      currency, paymentTerms, creditLimit, rating, isActive,
      // Phase 3, C12: productBrandingMode + privateLabelProductName editable
      // from CustomerDetail. brandRelationships stays write-protected here
      // (auto-managed by cross-brand auto-add, C13).
      productBrandingMode, privateLabelProductName,
    } = req.body;

    const customer = await db.Customer.findByPk(id);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const beforeSnapshot = customer.toJSON();

    // Phase 3, C12: productBrandingMode + lock enforcement.
    const updates = {
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
    };

    const wantsBrandingChange =
      (productBrandingMode !== undefined && productBrandingMode !== customer.productBrandingMode) ||
      (privateLabelProductName !== undefined && privateLabelProductName !== customer.privateLabelProductName);

    if (wantsBrandingChange) {
      // Lock enforcement: non-super_admin cannot change once a quotation
      // has been sent under the current mode. Super_admin uses the
      // dedicated /override-branding-mode-lock endpoint to clear the lock.
      if (customer.productBrandingModeLockedAt && req.user.role !== 'super_admin') {
        throw new ValidationError(
          'Product branding mode is locked. A quotation has already been sent under the current mode. ' +
          'Ask super-admin to clear the lock via Override.'
        );
      }
      // Validation: if mode is private_label, privateLabelProductName must be non-empty.
      const finalMode = productBrandingMode !== undefined ? productBrandingMode : customer.productBrandingMode;
      const finalName = privateLabelProductName !== undefined ? privateLabelProductName : customer.privateLabelProductName;
      if (finalMode === 'private_label' && (!finalName || !finalName.trim())) {
        throw new ValidationError(
          'privateLabelProductName is required when productBrandingMode is "private_label"'
        );
      }
      if (productBrandingMode !== undefined) updates.productBrandingMode = productBrandingMode;
      if (privateLabelProductName !== undefined) updates.privateLabelProductName = privateLabelProductName;
    }

    await customer.update(updates);

    res.json(getSuccessResponse(customer, 'Customer updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Customer', id, { before: beforeSnapshot, after: customer.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Phase 3, C12: super_admin-only override of the productBrandingMode lock.
 *
 * POST /api/customers/:id/override-branding-mode-lock
 * Body: { newMode: 'ironlite'|'generic'|'private_label', newPrivateLabelProductName?: string, reason: string }
 *
 * Clears productBrandingModeLockedAt and sets the new mode (and optional
 * private-label name). Writes a `product_branding_mode_override` AuditLog
 * row with the old and new mode plus the reason.
 *
 * `reason` is required (min 3 chars), matching the brand-override
 * endpoint convention in brandRoutes.js.
 */
const overrideProductBrandingModeLock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newMode, newPrivateLabelProductName, reason } = req.body;

    if (!reason || reason.trim().length < 3) {
      throw new ValidationError('reason is required (minimum 3 characters)');
    }
    if (!['ironlite', 'generic', 'private_label'].includes(newMode)) {
      throw new ValidationError('newMode must be one of: ironlite, generic, private_label');
    }
    if (newMode === 'private_label' && (!newPrivateLabelProductName || !newPrivateLabelProductName.trim())) {
      throw new ValidationError('newPrivateLabelProductName is required when newMode is "private_label"');
    }

    const customer = await db.Customer.findByPk(id);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const oldMode = customer.productBrandingMode;
    const oldName = customer.privateLabelProductName;
    const oldLockedAt = customer.productBrandingModeLockedAt;

    await customer.update({
      productBrandingMode: newMode,
      privateLabelProductName: newMode === 'private_label' ? newPrivateLabelProductName : null,
      productBrandingModeLockedAt: null,
    });

    res.json(getSuccessResponse(customer, 'Product branding mode override applied'));

    // Audit log — fire-and-forget. Mirrors the brand-override pattern.
    auditService.logAction(
      req.user.id,
      'product_branding_mode_override',
      'Customer',
      id,
      {
        oldMode, newMode,
        oldPrivateLabelProductName: oldName,
        newPrivateLabelProductName: newMode === 'private_label' ? newPrivateLabelProductName : null,
        oldLockedAt,
        newLockedAt: null,
        reason,
      },
      req.ip,
    ).catch(() => {});
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
    // Phase 4.28h: column is `total`, not `totalAmount`. The original
    // controller used `totalAmount` which threw "no such column" on every
    // call, so this endpoint had been returning HTTP 500 in prod since
    // it shipped. paidAmount is fine (camelCase resolves to paid_amount).
    let invoicedTotal = 0;
    let paidTotal = 0;
    if (db.Invoice) {
      const invoices = await db.Invoice.findAll({
        where: {
          customerId: id,
          createdAt: { [Op.between]: [from, to] },
        },
        attributes: ['id', 'total', 'paidAmount', 'currency', 'status'],
      });
      for (const inv of invoices) {
        // Invoice totals are stored in the customer's currency typically; for
        // the v1 P&L we treat all numerics as USD-equivalent (most Sovern
        // invoices are USD anyway). A fuller version would convert via
        // ExchangeRate using each invoice's currency + invoice date.
        invoicedTotal += Number(inv.total)      || 0;
        paidTotal     += Number(inv.paidAmount) || 0;
      }
    }

    // ─── COGS: PurchaseOrder costs for this customer's SalesOrders ────────────
    // PurchaseOrder column is also `total` (same bug class).
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
          attributes: ['id', 'total', 'currency'],
        });
        for (const po of pos) cogsTotal += Number(po.total) || 0;
      }
    }

    // ─── Direct expenses: Expense rows with customerId = X ──────────────────
    // Phase 4.28h: also capture submissionStatus + brandCode so the response
    // can surface reimbursements separately and split by brand. Sovern's FW/HH
    // agent-model deals reimburse most direct expenses through the factory;
    // the cash net is only the unreimbursed portion. SH expenses do not
    // reimburse (Sovern bears them) so they always count as unreimbursed.
    const directExpenseRows = await db.Expense.findAll({
      where: {
        customerId: id,
        entryDate: { [Op.between]: [fromIso, toIso] },
      },
      attributes: ['id', 'usdAmount', 'originalAmount', 'originalCurrency', 'submissionStatus', 'brandCode'],
    });
    const usdOf = (e) => {
      if (e.usdAmount != null) return Number(e.usdAmount);
      if ((e.originalCurrency || '').toUpperCase() === 'USD') return Number(e.originalAmount || 0);
      return 0; // skip rows with no usdAmount + non-USD currency to avoid mixing
    };
    const directExpensesTotal = directExpenseRows.reduce((sum, e) => sum + usdOf(e), 0);

    // Reimbursements received = direct expenses where the submitting office
    // has already paid Alex back. submissionStatus 'paid' is the canonical
    // signal. 'not_claimable' rows are NOT reimbursed (Sovern eats them).
    const reimbursedRows = directExpenseRows.filter((e) => e.submissionStatus === 'paid');
    const reimbursementsTotal = reimbursedRows.reduce((sum, e) => sum + usdOf(e), 0);
    const unreimbursedExpensesTotal = directExpensesTotal - reimbursementsTotal;

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
        attributes: ['total'],
      });
      totalPeriodRevenue = allInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
    }
    const revenueShare = totalPeriodRevenue > 0 ? invoicedTotal / totalPeriodRevenue : 0;
    const allocatedOverhead = overheadTotal * revenueShare;

    // ─── Commission revenue (FW/HH agent model) ──────────────────────────────
    // For FW/HH deals the buyer-facing price is already inclusive of Sovern's
    // commission. Invoice − PO produces $0 gross margin by design; Sovern's
    // actual revenue lives in CommissionTracking, accrued at SalesOrder
    // status='confirmed'. Pull it here so the P&L reflects real income.
    let commissionAccruedTotal = 0;
    let commissionPaidTotal = 0;
    let commissionCount = 0;
    const commissionByBrand = new Map();
    if (db.CommissionTracking) {
      const commissionRows = await db.CommissionTracking.findAll({
        where: {
          customerId: id,
          accrualDate: { [Op.between]: [from, to] },
        },
        attributes: ['id', 'amount', 'status', 'brandCode'],
      });
      for (const r of commissionRows) {
        const amt = Number(r.amount || 0);
        if (!Number.isFinite(amt)) continue;
        commissionCount++;
        if (r.status === 'paid') commissionPaidTotal += amt;
        if (r.status !== 'clawed_back') commissionAccruedTotal += amt;
        const bc = r.brandCode || 'FW';
        commissionByBrand.set(bc, (commissionByBrand.get(bc) || 0) + amt);
      }
    }
    const commissionRevenue = {
      accrued: round2(commissionAccruedTotal),
      paid:    round2(commissionPaidTotal),
      total:   round2(commissionAccruedTotal),
      count:   commissionCount,
      byBrand: Array.from(commissionByBrand.entries()).map(([brandCode, amount]) => ({
        brandCode,
        amount: round2(amount),
      })),
    };

    // ─── Aggregates ─────────────────────────────────────────────────────────
    // grossProfit + netProfit retained for backwards compat (Invoice − PO −
    // expenses − overhead). totalNetProfit folds commission revenue and
    // reimbursements in so the agent-model deals don't show as fake losses.
    const grossProfit = invoicedTotal - cogsTotal;
    const netProfit   = grossProfit - directExpensesTotal - allocatedOverhead;
    const directCostRatio = invoicedTotal > 0 ? directExpensesTotal / invoicedTotal : null;
    const netCommissionProfit = commissionAccruedTotal - unreimbursedExpensesTotal;
    const totalNetProfit = grossProfit + commissionAccruedTotal - unreimbursedExpensesTotal - allocatedOverhead;

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
      // Phase 4.28h: subset of directExpenses that have been reimbursed by
      // the factory (Expense.submissionStatus='paid'). Cash-net impact is
      // zero for these; they are tracked for visibility on the agent-model
      // P&L but excluded from netCommissionProfit / totalNetProfit.
      reimbursementsReceived: {
        total: round2(reimbursementsTotal),
        count: reimbursedRows.length,
      },
      unreimbursedExpenses: {
        total: round2(unreimbursedExpensesTotal),
        count: directExpenseRows.length - reimbursedRows.length,
      },
      allocatedOverhead: {
        total:        round2(allocatedOverhead),
        basis:        'revenue_share',
        revenueShare: round4(revenueShare),
        overheadPool: round2(overheadTotal),
      },
      // Phase 4.28h: commission revenue from FW/HH agent-model deals.
      // CommissionTracking rows accrue at SalesOrder.status='confirmed';
      // the 7% Sovern earns on each FW/HH order lands here, not in the
      // Invoice − PO gross margin (which is $0 by design for those brands).
      commissionRevenue,
      grossProfit: round2(grossProfit),
      netProfit:   round2(netProfit),
      // Phase 4.28h:
      //   netCommissionProfit = commissionRevenue.accrued − unreimbursedExpenses
      //     The agent-model P&L for FW/HH. Excludes the Invoice − PO axis
      //     which is structurally $0 for these brands.
      //   totalNetProfit = grossProfit + commissionRevenue.accrued
      //                    − unreimbursedExpenses − allocatedOverhead
      //     The blended view across both SH (markup margin) and FW/HH
      //     (commission) revenue streams for this customer.
      netCommissionProfit: round2(netCommissionProfit),
      totalNetProfit:      round2(totalNetProfit),
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
  overrideProductBrandingModeLock,
};
