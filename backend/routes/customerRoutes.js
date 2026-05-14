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
const { requireAuth, requireAny, requireRole } = require('../middleware/auth');
const { brandScope } = require('../middleware/brandScope');
const { body, handleValidationErrors } = require('../middleware/validation');
const { validate, customerSchemas } = require('../middleware/zodValidation');

// Phase 1 Commit 3b-B: router-level requireAuth + brandScope so every
// customer endpoint has req.brandScope. Per-route requireAuth below is
// redundant-but-harmless (idempotent).
router.use(requireAuth, brandScope);

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

// Phase 3, C12: super_admin-only override of the productBrandingMode
// lock. L-031 bare-string requireRole.
router.post(
  '/:id/override-branding-mode-lock',
  requireAuth,
  requireRole('super_admin'),
  customerController.overrideProductBrandingModeLock,
);

router.get('/:id/balance', requireAuth, customerController.getBalance);

router.get('/:id/order-history', requireAuth, customerController.getOrderHistory);

router.get('/:id/dashboard', requireAuth, customerController.getDashboard);

router.get('/:id/profitability', requireAuth, customerController.getProfitability);

module.exports = router;
