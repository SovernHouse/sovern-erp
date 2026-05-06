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

// All roles supported by the RBAC system
const VALID_ROLES = [
  'admin', 'manager', 'sales', 'operations', 'finance', 'warehouse', 'quality', 'viewer',
  'ceo', 'coo', 'sales_rep', 'project_manager', 'accountant', 'cashier',
  'office_manager', 'procurement_officer', 'logistics_coordinator',
  'qc_inspector', 'customer_service', 'compliance_officer',
  // legacy
  'inspector', 'customer', 'factory',
];

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
    // Accept either firstName+lastName or a single name field (split on first space)
    let { email, password, firstName, lastName, phone, role, name, isActive } = req.body;
    if (!firstName && name) {
      const parts = name.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || '-';
    }

    if (!email || !password || !firstName || !lastName) {
      throw new ValidationError('Email, password, first name, and last name are required');
    }

    const existingUser = await db.User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    if (role && !VALID_ROLES.includes(role)) {
      throw new ValidationError('Invalid role provided');
    }

    const user = await db.User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      phone: phone || null,
      role: role || 'viewer',
      isActive: isActive !== undefined ? Boolean(isActive) : true
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
    let { firstName, lastName, phone, role, isActive, name } = req.body;
    if (!firstName && name) {
      const parts = name.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || '-';
    }

    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (role && !VALID_ROLES.includes(role)) {
      throw new ValidationError('Invalid role provided');
    }

    const previousData = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
    };

    // Prevent admin from deactivating themselves
    if (isActive === false && user.id === req.user.id) {
      throw new ValidationError('Cannot deactivate your own account');
    }

    await user.update({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      phone: phone !== undefined ? phone : user.phone,
      role: role || user.role,
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
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

    if (!VALID_ROLES.includes(role)) {
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

// PATCH /:id/activate - Toggle user active status (admin only)
router.patch('/:id/activate', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (!user) throw new NotFoundError('User not found');
    if (user.id === req.user.id) throw new ValidationError('Cannot deactivate your own account');

    const newActive = !user.isActive;
    await user.update({ isActive: newActive });

    const result = await db.User.findByPk(user.id, {
      attributes: { exclude: ['password', 'resetToken', 'resetExpiry'] }
    });

    res.json(getSuccessResponse(result, `User ${newActive ? 'activated' : 'deactivated'} successfully`));

    auditService.logAction(
      req.user.id, newActive ? 'ACTIVATE' : 'DEACTIVATE', 'User', user.id,
      { isActive: newActive }, req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PATCH /:id/reset-password - Reset another user's password (admin only)
router.patch('/:id/reset-password', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    const user = await db.User.findByPk(req.params.id);
    if (!user) throw new NotFoundError('User not found');

    await user.update({ password });

    res.json(getSuccessResponse(null, 'Password reset successfully'));

    auditService.logAction(
      req.user.id, 'RESET_PASSWORD', 'User', user.id, {}, req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
