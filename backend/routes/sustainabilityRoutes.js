/**
 * Sustainability & Carbon Tracking Routes
 * @module routes/sustainabilityRoutes
 * @description Endpoints for managing product sustainability data and carbon footprint calculations
 * @requires express
 * @requires ../middleware/auth
 * @requires ../controllers/sustainabilityController
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sustainabilityController = require('../controllers/sustainabilityController');

/**
 * Create or update sustainability record for a product
 * @route POST /api/sustainability
 */
router.post('/', requireAuth, requireRole('admin', 'product'), sustainabilityController.create);

/**
 * Get sustainability data for a product
 * @route GET /api/sustainability/product/:productId
 */
router.get('/product/:productId', requireAuth, sustainabilityController.getProductSustainability);

/**
 * Get sustainability report across products
 * @route GET /api/sustainability/report
 */
router.get('/report', requireAuth, sustainabilityController.getSustainabilityReport);

/**
 * Calculate carbon footprint for a shipment
 * @route POST /api/sustainability/calculate-shipment-carbon
 */
router.post('/calculate-shipment-carbon', requireAuth, sustainabilityController.calculateShipmentCarbon);

/**
 * Update a sustainability record
 * @route PUT /api/sustainability/:id
 */
router.put('/:id', requireAuth, requireRole('admin', 'product'), sustainabilityController.update);

/**
 * Delete a sustainability record
 * @route DELETE /api/sustainability/:id
 */
router.delete('/:id', requireAuth, requireRole('admin', 'product'), sustainabilityController.delete);

module.exports = router;
