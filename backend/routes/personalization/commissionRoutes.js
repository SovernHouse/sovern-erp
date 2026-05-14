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

/**
 * Get user's filter presets
 * @route GET /api/personalization/filter-presets
 */

module.exports = router;
