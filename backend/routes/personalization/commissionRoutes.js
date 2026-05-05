const express = require('express');
const router = express.Router();
const db = require('../../models');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { getSuccessResponse } = require('../../utils/helpers');
const { Op } = require('sequelize');

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
 * Get user's filter presets
 * @route GET /api/personalization/filter-presets
 */

module.exports = router;
