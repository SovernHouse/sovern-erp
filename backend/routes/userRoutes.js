/**
 * User Management Routes
 * @module routes/userRoutes
 * @description Endpoints for managing users, roles, and permissions
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 * @requires ../services/auditService
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

/**
 * List all users with pagination and filtering
 * @route GET /api/users
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @param {string} search - Search by name or email
 * @param {string} role - Filter by user role
 * @param {string} status - Filter by user status
 * @returns {Object} Paginated list of users
 * @access Admin only
 */
router.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};

    if (role) {
      where.role = role;
    }

    if (status) {
      where.isActive = status === 'active';
    }

    if (search) {
      where[Op.or] = [
        { email: { [Op.like]: `%${search}%` } },
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await db.User.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      attributes: { exclude: ['password', 'resetToken', 'resetExpiry'] },
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
});

// GET /:id - Get single user (admin only)
router.get('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const user = await db.User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'resetToken', 'resetExpiry'] }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json(getSuccessResponse(user, 'User retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// POST / - Create new user (admin only)
router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      throw new ValidationError('Email, password, first name, and last name are required');
    }

    const existingUser = await db.User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    const validRoles = ['admin', 'sales', 'operations', 'finance', 'inspector', 'customer', 'factory'];
    if (role && !validRoles.includes(role)) {
      throw new ValidationError('Invalid role provided');
    }

    const user = await db.User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      phone: phone || null,
      role: role || 'customer',
      isActive: true
    });

    const result = await db.User.findByPk(user.id, {
      attributes: { exclude: ['password', 'resetToken', 'resetExpiry'] }
    });

    res.status(201).json(getSuccessResponse(result, 'User created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'CREATE',
      'User',
      user.id,
      { email, firstName, lastName, phone, role },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PUT /:id - Update user (admin only)
router.put('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { firstName, lastName, phone, role } = req.body;

    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const validRoles = ['admin', 'sales', 'operations', 'finance', 'inspector', 'customer', 'factory'];
    if (role && !validRoles.includes(role)) {
      throw new ValidationError('Invalid role provided');
    }

    const previousData = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role
    };

    await user.update({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      phone: phone !== undefined ? phone : user.phone,
      role: role || user.role
    });

    const result = await db.User.findByPk(user.id, {
      attributes: { exclude: ['password', 'resetToken', 'resetExpiry'] }
    });

    res.json(getSuccessResponse(result, 'User updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'UPDATE',
      'User',
      user.id,
      { before: previousData, after: { firstName: user.firstName, lastName: user.lastName, phone: user.phone, role: user.role } },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// DELETE /:id - Soft delete / deactivate user (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Prevent deactivating self
    if (user.id === req.user.id) {
      throw new ValidationError('Cannot deactivate your own account');
    }

    await user.update({ isActive: false });

    const result = await db.User.findByPk(user.id, {
      attributes: { exclude: ['password', 'resetToken', 'resetExpiry'] }
    });

    res.json(getSuccessResponse(result, 'User deactivated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'DEACTIVATE',
      'User',
      user.id,
      { isActive: false },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PATCH /:id/role - Assign role to user (admin only)
router.patch('/:id/role', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!role) {
      throw new ValidationError('Role is required');
    }

    const validRoles = ['admin', 'sales', 'operations', 'finance', 'inspector', 'customer', 'factory'];
    if (!validRoles.includes(role)) {
      throw new ValidationError('Invalid role provided');
    }

    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const previousRole = user.role;
    await user.update({ role });

    const result = await db.User.findByPk(user.id, {
      attributes: { exclude: ['password', 'resetToken', 'resetExpiry'] }
    });

    res.json(getSuccessResponse(result, 'User role updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'UPDATE_ROLE',
      'User',
      user.id,
      { previousRole, newRole: role },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
