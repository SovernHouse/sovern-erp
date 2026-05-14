const express = require('express');
const router = express.Router();
const db = require('../../models');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { getSuccessResponse } = require('../../utils/helpers');
const { Op } = require('sequelize');
const { updateCommissionPercentage } = require('../../services/commissionAccrual');
const { NotFoundError, ValidationError } = require('../../middleware/errorHandler');

router.get('/commissions/rules', requireAuth, requireRole('admin', 'finance'), async (req, res, next) => {
  try {
    const rules = await db.CommissionRule.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(rules));
  } catch (error) {
    next(error);
  }
});

/**
 * Create commission rule
 * @route POST /api/personalization/commissions/rules
 * @body {Object} rule - Commission rule details
 */
router.post('/commissions/rules', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, description, ruleType, baseValue, minAmount, maxAmount, tiers, applicableRoles } = req.body;

    const rule = await db.CommissionRule.create({
      name,
      description,
      ruleType,
      baseValue,
      minAmount,
      maxAmount,
      tiers,
      applicableRoles: applicableRoles || ['sales']
    });

    res.json(getSuccessResponse({
      message: 'Commission rule created successfully',
      data: rule
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get user's commission earnings
 * @route GET /api/personalization/commissions/my
 */
router.get('/commissions/my', requireAuth, async (req, res, next) => {
  try {
    const commissions = await db.CommissionTracking.findAll({
      where: { userId: req.user.id },
      include: [
        { model: db.CommissionRule, as: 'commissionRule', attributes: ['name', 'ruleType'] },
        { model: db.SalesOrder, attributes: ['id', 'orderNumber', 'total', 'createdAt'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    const stats = {
      totalEarned: 0,
      pending: 0,
      approved: 0,
      paid: 0,
      disputed: 0
    };

    commissions.forEach(c => {
      stats.totalEarned += parseFloat(c.amount);
      stats[c.status] = (stats[c.status] || 0) + parseFloat(c.amount);
    });

    res.json(getSuccessResponse({
      stats,
      commissions
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get all user commissions (admin)
 * @route GET /api/personalization/commissions
 */
router.get('/commissions', requireAuth, requireRole('admin', 'finance'), async (req, res, next) => {
  try {
    const { userId, status, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await db.CommissionTracking.findAndCountAll({
      where,
      include: [
        { model: db.User, attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: db.CommissionRule, as: 'commissionRule' },
        { model: db.SalesOrder, attributes: ['id', 'orderNumber'] }
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit)
    });

    res.json(getSuccessResponse({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Phase 3, C11: per-order summary for a single user (or all users when
 * called by super_admin / finance). Filterable by brand via the SalesOrder
 * join. Used by CommissionWidget on dashboards.
 *
 * Returns { accrued, paid, pending, currency, period: 'mtd' | 'all', byMonth }.
 *
 * Query params:
 *   - userId   (optional) — defaults to req.user.id
 *   - brandCode (optional, default 'FW') — narrows commissions to SOs of
 *     this brand
 *   - period   ('mtd' | 'all', default 'mtd')
 */
router.get('/commissions/summary', requireAuth, async (req, res, next) => {
  try {
    const userId = req.query.userId || req.user.id;
    if (userId !== req.user.id) {
      // Anyone can query their own; only super_admin / finance can query others.
      if (!['super_admin', 'admin', 'finance'].includes(req.user.role)) {
        throw new ValidationError('Not allowed to query commissions for another user');
      }
    }
    const brandCode = req.query.brandCode || 'FW';
    const period = req.query.period === 'all' ? 'all' : 'mtd';

    // Monthly window in Asia/Taipei (L-042). "MTD" = from the 1st of the
    // current Taipei month to now. Compute the boundary in UTC for the
    // SQL where-clause since createdAt is stored UTC.
    const now = new Date();
    const taipei = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const startOfMonth = new Date(Date.UTC(taipei.getFullYear(), taipei.getMonth(), 1));
    // Adjust: Asia/Taipei is UTC+8; subtract 8h so 00:00 Taipei → 16:00 UTC prev day.
    startOfMonth.setUTCHours(startOfMonth.getUTCHours() - 8);

    const where = { userId };
    if (period === 'mtd') where.createdAt = { [Op.gte]: startOfMonth };

    const rows = await db.CommissionTracking.findAll({
      where,
      include: [
        {
          model: db.SalesOrder,
          attributes: ['id', 'orderNumber', 'brandCode', 'currency', 'total', 'createdAt'],
          where: { brandCode },
          required: true,
        },
        { model: db.CommissionRule, as: 'commissionRule', attributes: ['name', 'baseValue'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const summary = { accrued: 0, paid: 0, pending: 0, approved: 0, disputed: 0, cancelled: 0 };
    rows.forEach(r => {
      const amt = parseFloat(r.amount) || 0;
      summary.accrued += amt;
      summary[r.status] = (summary[r.status] || 0) + amt;
    });

    res.json(getSuccessResponse({
      brandCode,
      period,
      summary,
      currency: 'USD',
      rows,
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Phase 3, C11: adjust the per-order commission percentage. Recalculates
 * `amount` from the existing `orderAmount`. Super_admin can edit any row;
 * a regular user can edit their own rows only while status is 'pending'.
 *
 * Body: { percentage: number, notes?: string }
 */
router.patch('/commissions/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { percentage, notes } = req.body;
    const row = await db.CommissionTracking.findByPk(id);
    if (!row) throw new NotFoundError('Commission row not found');

    const isOwner = row.userId === req.user.id;
    const isSuperAdmin = req.user.role === 'super_admin';
    if (!isSuperAdmin && (!isOwner || row.status !== 'pending')) {
      throw new ValidationError('You can only edit your own pending commission rows');
    }

    if (percentage !== undefined) {
      await updateCommissionPercentage(row, percentage);
    }
    if (notes !== undefined) {
      await row.update({ notes });
    }

    res.json(getSuccessResponse(row, 'Commission updated'));
  } catch (error) {
    next(error);
  }
});

/**
 * Phase 3, C11: super_admin "All Brands" aggregate revenue widget.
 * Returns SH vs FW revenue + commission totals for the current MTD,
 * suitable for a stacked / side-by-side bar widget on the dashboard.
 */
router.get('/commissions/brand-comparison', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const now = new Date();
    const taipei = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const startOfMonth = new Date(Date.UTC(taipei.getFullYear(), taipei.getMonth(), 1));
    startOfMonth.setUTCHours(startOfMonth.getUTCHours() - 8);

    const brands = await db.Brand.findAll({ where: { active: true } });
    const results = [];
    for (const b of brands) {
      const sos = await db.SalesOrder.findAll({
        where: { brandCode: b.code, createdAt: { [Op.gte]: startOfMonth } },
        attributes: ['total'],
      });
      const revenue = sos.reduce((sum, so) => sum + (parseFloat(so.total) || 0), 0);

      const commissionRows = await db.CommissionTracking.findAll({
        include: [{
          model: db.SalesOrder,
          where: { brandCode: b.code, createdAt: { [Op.gte]: startOfMonth } },
          attributes: [],
          required: true,
        }],
      });
      const commission = commissionRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

      results.push({
        brandCode: b.code,
        displayName: b.displayName,
        primaryColor: b.primaryColor,
        revenue,
        commission,
        orderCount: sos.length,
      });
    }

    res.json(getSuccessResponse({ period: 'mtd', brands: results }));
  } catch (error) {
    next(error);
  }
});

// ─── Phase 4, C15 — FW commission dashboard + ledger transitions ─────────

/**
 * Require the user to have FW in their accessibleBrands OR be super_admin.
 * Used to gate the FW-specific commission dashboard so a sales rep with
 * SH-only access never sees commission data they shouldn't.
 */
function requireFwAccess(req, res, next) {
  if (req.user?.role === 'super_admin') return next();
  const accessible = req.brandScope?.accessibleBrands || [];
  if (Array.isArray(accessible) && accessible.includes('FW')) return next();
  return res.status(403).json({
    success: false,
    message: 'FW access required for commission dashboard',
  });
}

/**
 * Asia/Taipei month-to-date boundary expressed in UTC (createdAt is UTC).
 */
function mtdStart() {
  const now = new Date();
  const taipei = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const start = new Date(Date.UTC(taipei.getFullYear(), taipei.getMonth(), 1));
  start.setUTCHours(start.getUTCHours() - 8);  // Taipei is UTC+8
  return start;
}
function quarterStart() {
  const now = new Date();
  const taipei = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const q = Math.floor(taipei.getMonth() / 3) * 3;
  const start = new Date(Date.UTC(taipei.getFullYear(), q, 1));
  start.setUTCHours(start.getUTCHours() - 8);
  return start;
}
function ytdStart() {
  const now = new Date();
  const taipei = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const start = new Date(Date.UTC(taipei.getFullYear(), 0, 1));
  start.setUTCHours(start.getUTCHours() - 8);
  return start;
}

/**
 * GET /api/personalization/commissions/dashboard?brand=FW
 *
 * Returns full FW commission dashboard data.
 *   {
 *     brandCode,
 *     kpis: { mtdAccrued, qtdAccrued, ytdAccrued, pendingPayment },
 *     pipelineForecast: number,  // open quotations × rate (probability-by-stage)
 *     deals: [{ id, orderNumber, customerName, accrualDate, amount, status, percentage, daysOpen }],
 *     outstanding: [{ id, orderNumber, customerName, daysOpen, amount }],  // status accrued/invoiced_to_factory > 30d
 *   }
 */
router.get('/commissions/dashboard', requireAuth, requireFwAccess, async (req, res, next) => {
  try {
    const brandCode = req.query.brand || req.query.brandCode || 'FW';

    const sumAmounts = (rows) => rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    const [mtd, qtd, ytd, allOpen] = await Promise.all([
      db.CommissionTracking.findAll({
        where: { brandCode, createdAt: { [Op.gte]: mtdStart() } },
        attributes: ['amount'],
      }),
      db.CommissionTracking.findAll({
        where: { brandCode, createdAt: { [Op.gte]: quarterStart() } },
        attributes: ['amount'],
      }),
      db.CommissionTracking.findAll({
        where: { brandCode, createdAt: { [Op.gte]: ytdStart() } },
        attributes: ['amount'],
      }),
      db.CommissionTracking.findAll({
        where: { brandCode, status: { [Op.in]: ['accrued', 'invoiced_to_factory', 'pending'] } },
        attributes: ['amount'],
      }),
    ]);

    const kpis = {
      mtdAccrued: sumAmounts(mtd),
      qtdAccrued: sumAmounts(qtd),
      ytdAccrued: sumAmounts(ytd),
      pendingPayment: sumAmounts(allOpen),
    };

    // Pipeline forecast: open quotations under brand × commission rate.
    // Use override when present, else Brand.commissionRate.
    const brandRow = await db.Brand.findOne({ where: { code: brandCode } });
    const brandRate = brandRow ? parseFloat(brandRow.commissionRate || 0) : 0;
    const openQuotes = await db.Quotation.findAll({
      where: {
        brandCode,
        status: { [Op.in]: ['draft', 'sent', 'revised'] },
        deletedAt: null,
      },
      attributes: ['total', 'commissionRateOverride'],
    });
    const pipelineForecast = openQuotes.reduce((s, q) => {
      const rate = q.commissionRateOverride != null
        ? parseFloat(q.commissionRateOverride)
        : brandRate;
      return s + (parseFloat(q.total || 0) * rate);
    }, 0);

    // Deal-level table — recent + active.
    const deals = await db.CommissionTracking.findAll({
      where: { brandCode },
      include: [
        { model: db.SalesOrder, attributes: ['id', 'orderNumber', 'createdAt'] },
        { model: db.Customer, attributes: ['id', 'companyName'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    const dealsList = deals.map((r) => {
      const daysOpen = r.createdAt
        ? Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86400000)
        : null;
      return {
        id: r.id,
        orderNumber: r.SalesOrder?.orderNumber || null,
        customerName: r.Customer?.companyName || null,
        accrualDate: r.accrualDate || r.createdAt,
        amount: parseFloat(r.amount || 0),
        percentage: parseFloat(r.percentage || 0),
        status: r.status,
        daysOpen,
      };
    });

    // Outstanding: accrued or invoiced_to_factory for >30 days.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const outstanding = dealsList.filter((d) =>
      (d.status === 'accrued' || d.status === 'invoiced_to_factory') &&
      d.daysOpen != null && d.daysOpen > 30
    );

    res.json(getSuccessResponse({
      brandCode,
      kpis,
      pipelineForecast,
      deals: dealsList,
      outstanding,
      currency: 'USD',
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/personalization/commissions/:id/mark-paid
 *
 * Super-admin only. Sets status='paid', paidDate=now. Audited.
 */
router.post('/commissions/:id/mark-paid', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const row = await db.CommissionTracking.findByPk(req.params.id);
    if (!row) throw new NotFoundError('Commission row not found');
    const prevStatus = row.status;
    await row.update({ status: 'paid', paidDate: new Date() });
    const auditService = require('../../services/auditService');
    auditService.logAction(req.user.id, 'commission_paid', 'CommissionTracking', row.id, {
      previousStatus: prevStatus,
      amount: row.amount,
      paidDate: row.paidDate,
    }, req.ip).catch(() => {});
    res.json(getSuccessResponse(row, 'Commission marked paid'));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/personalization/commissions/:id/claw-back
 *
 * Super-admin only. Body: { reason: string (>= 5 chars) }. Sets
 * status='clawed_back'. Audited.
 */
router.post('/commissions/:id/claw-back', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || String(reason).trim().length < 5) {
      throw new ValidationError('reason is required (>= 5 characters)');
    }
    const row = await db.CommissionTracking.findByPk(req.params.id);
    if (!row) throw new NotFoundError('Commission row not found');
    const prevStatus = row.status;
    await row.update({
      status: 'clawed_back',
      notes: `${row.notes ? row.notes + '\n' : ''}Clawed back: ${reason}`,
    });
    const auditService = require('../../services/auditService');
    auditService.logAction(req.user.id, 'commission_clawed_back', 'CommissionTracking', row.id, {
      previousStatus: prevStatus,
      amount: row.amount,
      reason,
    }, req.ip).catch(() => {});
    res.json(getSuccessResponse(row, 'Commission clawed back'));
  } catch (error) {
    next(error);
  }
});

/**
 * Get user's filter presets
 * @route GET /api/personalization/filter-presets
 */

module.exports = router;
