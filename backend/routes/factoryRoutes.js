/**
 * Factory Management Routes
 * @module routes/factoryRoutes
 * @description Endpoints for managing factories and their products
 * @requires express
 * @requires ../controllers/factoryController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 * @requires ../middleware/zodValidation
 */

const express = require('express');
const router = express.Router();
const factoryController = require('../controllers/factoryController');
const { requireAuth, requireAny } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');
const { validate, factorySchemas } = require('../middleware/zodValidation');

/**
 * Create a new factory
 * @route POST /api/factories
 * @param {string} companyName - Factory company name
 * @param {string} email - Factory email
 * @param {string} phone - Factory phone number
 * @returns {Object} Created factory object
 */
router.post('/', requireAuth, requireAny('factories'),
  body('companyName').notEmpty(),
  body('email').isEmail(),
  body('phone').notEmpty(),
  handleValidationErrors,
  validate(factorySchemas.create),
  factoryController.create
);

router.get('/', requireAuth, factoryController.getAll);

router.get('/:id', requireAuth, factoryController.getById);

router.put('/:id', requireAuth, requireAny('factories'),
  handleValidationErrors,
  factoryController.update
);

router.get('/:id/products', requireAuth, factoryController.getProducts);

router.post('/:id/update-prices', requireAuth, requireAny('factories'),
  body('prices').isArray(),
  handleValidationErrors,
  factoryController.updatePrices
);

router.get('/:id/performance', requireAuth, factoryController.getPerformance);

module.exports = router;
