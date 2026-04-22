/**
 * Authentication Routes
 * @module routes/authRoutes
 * @description User authentication endpoints including registration, login, password reset, and profile management
 * @requires express
 * @requires ../controllers/authController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 * @requires ../middleware/zodValidation
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');
const { validate, authSchemas } = require('../middleware/zodValidation');
const passwordValidator = require('../utils/passwordValidator');

/**
 * Register a new user
 * @route POST /api/auth/register
 * @param {string} email - User email address
 * @param {string} password - User password (min 8 chars, uppercase, lowercase, number, special char)
 * @param {string} firstName - User first name
 * @param {string} lastName - User last name
 * @returns {Object} User object with JWT token
 */
router.post('/register',
  body('email').isEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      const validation = passwordValidator.validate(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join('; '));
      }
      return true;
    }),
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  handleValidationErrors,
  validate(authSchemas.register),
  authController.register
);

router.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  handleValidationErrors,
  validate(authSchemas.login),
  authController.login
);

router.post('/forgot-password',
  body('email').isEmail(),
  handleValidationErrors,
  validate(authSchemas.forgotPassword),
  authController.forgotPassword
);

router.post('/reset-password',
  body('token').notEmpty(),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      const validation = passwordValidator.validate(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join('; '));
      }
      return true;
    }),
  handleValidationErrors,
  validate(authSchemas.resetPassword),
  authController.resetPassword
);

router.post('/logout', requireAuth, authController.logout);

router.post('/refresh', authController.refreshToken);

router.get('/me', requireAuth, authController.getCurrentUser);

router.put('/profile', requireAuth,
  body('firstName').optional().notEmpty(),
  body('lastName').optional().notEmpty(),
  handleValidationErrors,
  authController.updateProfile
);

/**
 * Get staff members available for assignment (admin, sales, manager roles)
 * Used by CRM forms to populate "Assigned to" dropdowns.
 * @route GET /api/auth/staff
 */
router.get('/staff', requireAuth, async (req, res) => {
  try {
    const db = require('../models');
    const staff = await db.User.findAll({
      where: { role: ['admin', 'sales', 'manager'], isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
    });
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch staff.' });
  }
});

router.post('/change-password', requireAuth,
  body('currentPassword').notEmpty(),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      const validation = passwordValidator.validate(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join('; '));
      }
      return true;
    }),
  handleValidationErrors,
  validate(authSchemas.changePassword),
  authController.changePassword
);

module.exports = router;
