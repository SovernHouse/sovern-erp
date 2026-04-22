/**
 * Customer Management Routes
 * @module routes/customerRoutes
 * @description Endpoints for managing customers including CRUD operations, balance tracking, and order history
 * @requires express
 * @requires ../controllers/customerController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 * @requires ../middleware/zodValidation
 */

const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { requireAuth, requireAny } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');
const { validate, customerSchemas } = require('../middleware/zodValidation');

/**
 * Create a new customer
 * @route POST /api/customers
 * @param {string} companyName - Customer company name
 * @param {string} email - Customer email
 * @param {string} phone - Customer phone number
 * @returns {Object} Created customer object
 */
router.post('/', requireAuth, requireAny('customers'),
  body('companyName').notEmpty(),
  body('email').isEmail(),
  body('phone').notEmpty(),
  handleValidationErrors,
  validate(customerSchemas.create),
  customerController.create
);

router.get('/', requireAuth, requireAny('customers'), customerController.getAll);

router.get('/:id', requireAuth, requireAny('customers'), customerController.getById);

router.put('/:id', requireAuth, requireAny('customers'),
  handleValidationErrors,
  validate(customerSchemas.update),
  customerController.update
);

router.delete('/:id', requireAuth, requireAny('customers'), customerController.delete);

router.get('/:id/balance', requireAuth, customerController.getBalance);

router.get('/:id/order-history', requireAuth, customerController.getOrderHistory);

router.get('/:id/dashboard', requireAuth, customerController.getDashboard);

module.exports = router;
