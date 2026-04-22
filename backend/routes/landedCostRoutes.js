/**
 * Landed Cost Calculator Routes
 * @module routes/landedCostRoutes
 * @description Endpoints for calculating and managing landed costs
 * @requires express
 * @requires ../controllers/landedCostController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 */

const express = require('express');
const router = express.Router();
const landedCostController = require('../controllers/landedCostController');
const { requireAuth, requireAny } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');

/**
 * Calculate landed cost for a product
 * @route POST /api/landed-cost/calculate
 * @param {string} productId - Product ID
 * @param {string} supplierId - Supplier ID
 * @param {number} quantity - Product quantity
 * @param {number} productCost - Base product cost
 * @param {number} freight - Freight charges (optional)
 * @param {number} insurance - Insurance charges (optional)
 * @param {number} customsDuty - Customs duty (optional)
 * @param {number} handlingCharges - Handling charges (optional)
 * @param {number} localDelivery - Local delivery charges (optional)
 * @returns {Object} Calculated landed cost details
 */
router.post('/calculate', requireAuth, requireAny('landed-cost'),
  body('productId').notEmpty(),
  body('supplierId').notEmpty(),
  body('quantity').isNumeric(),
  body('productCost').isNumeric(),
  handleValidationErrors,
  landedCostController.calculate
);

/**
 * Get all landed cost calculations
 * @route GET /api/landed-cost/calculations
 * @query {string} productId - Filter by product
 * @query {string} supplierId - Filter by supplier
 * @query {string} purchaseOrderId - Filter by purchase order
 * @returns {Array} Array of calculations
 */
router.get('/calculations', requireAuth, landedCostController.getCalculations);

/**
 * Get calculation by ID
 * @route GET /api/landed-cost/calculations/:id
 * @param {string} id - Calculation ID
 * @returns {Object} Calculation details
 */
router.get('/calculations/:id', requireAuth, landedCostController.getCalculationById);

/**
 * Update calculation
 * @route PUT /api/landed-cost/calculations/:id
 * @param {string} id - Calculation ID
 * @returns {Object} Updated calculation
 */
router.put('/calculations/:id', requireAuth, requireAny('landed-cost'),
  landedCostController.updateCalculation
);

/**
 * Delete calculation
 * @route DELETE /api/landed-cost/calculations/:id
 * @param {string} id - Calculation ID
 * @returns {Object} Success message
 */
router.delete('/calculations/:id', requireAuth, requireAny('landed-cost'),
  landedCostController.deleteCalculation
);

/**
 * Get all templates
 * @route GET /api/landed-cost/templates
 * @query {string} supplier - Filter by supplier
 * @query {boolean} active - Filter by active status
 * @returns {Array} Array of templates
 */
router.get('/templates', requireAuth, landedCostController.getTemplates);

/**
 * Get template by ID
 * @route GET /api/landed-cost/templates/:id
 * @param {string} id - Template ID
 * @returns {Object} Template details
 */
router.get('/templates/:id', requireAuth, landedCostController.getTemplateById);

/**
 * Create new template
 * @route POST /api/landed-cost/templates
 * @param {string} name - Template name
 * @param {Object} components - Cost components
 * @param {Object} defaultPercentages - Default percentages
 * @returns {Object} Created template
 */
router.post('/templates', requireAuth, requireAny('landed-cost'),
  body('name').notEmpty(),
  body('components').notEmpty(),
  body('defaultPercentages').notEmpty(),
  handleValidationErrors,
  landedCostController.createTemplate
);

/**
 * Update template
 * @route PUT /api/landed-cost/templates/:id
 * @param {string} id - Template ID
 * @returns {Object} Updated template
 */
router.put('/templates/:id', requireAuth, requireAny('landed-cost'),
  landedCostController.updateTemplate
);

/**
 * Delete template
 * @route DELETE /api/landed-cost/templates/:id
 * @param {string} id - Template ID
 * @returns {Object} Success message
 */
router.delete('/templates/:id', requireAuth, requireAny('landed-cost'),
  landedCostController.deleteTemplate
);

/**
 * Calculate using template
 * @route POST /api/landed-cost/calculate-with-template
 * @param {string} templateId - Template ID
 * @param {number} productCost - Base product cost
 * @param {number} quantity - Quantity
 * @returns {Object} Calculated landed cost
 */
router.post('/calculate-with-template', requireAuth, requireAny('landed-cost'),
  body('templateId').notEmpty(),
  body('productCost').isNumeric(),
  body('quantity').isNumeric(),
  handleValidationErrors,
  landedCostController.calculateWithTemplate
);

module.exports = router;
