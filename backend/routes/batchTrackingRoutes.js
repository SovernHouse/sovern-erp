/**
 * Batch Tracking Routes
 * @module routes/batchTrackingRoutes
 * @description Endpoints for managing product batches and shade/caliber tracking
 * @requires express
 * @requires ../controllers/batchTrackingController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 */

const express = require('express');
const router = express.Router();
const batchTrackingController = require('../controllers/batchTrackingController');
const { requireAuth, requireAny } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');

/**
 * Create new batch
 * @route POST /api/batches
 * @param {string} batchNumber - Batch number
 * @param {string} productId - Product ID
 * @param {string} shadeCode - Shade code
 * @param {string} caliberCode - Caliber code (optional)
 * @param {date} productionDate - Production date
 * @param {number} totalQuantity - Total quantity
 * @returns {Object} Created batch
 */
router.post('/', requireAuth, requireAny('batches'),
  body('batchNumber').notEmpty(),
  body('productId').notEmpty(),
  body('shadeCode').notEmpty(),
  body('productionDate').isISO8601(),
  body('totalQuantity').isNumeric(),
  handleValidationErrors,
  batchTrackingController.createBatch
);

/**
 * Get all batches
 * @route GET /api/batches
 * @query {string} productId - Filter by product
 * @query {string} status - Filter by status
 * @query {string} shadeCode - Filter by shade
 * @returns {Array} Array of batches
 */
router.get('/', requireAuth, batchTrackingController.getBatches);

/**
 * Get batch by ID
 * @route GET /api/batches/:id
 * @param {string} id - Batch ID
 * @returns {Object} Batch details
 */
router.get('/:id', requireAuth, batchTrackingController.getBatchById);

/**
 * Update batch
 * @route PUT /api/batches/:id
 * @param {string} id - Batch ID
 * @returns {Object} Updated batch
 */
router.put('/:id', requireAuth, requireAny('batches'),
  batchTrackingController.updateBatch
);

/**
 * Get batches by product
 * @route GET /api/batches/by-product/:productId
 * @param {string} productId - Product ID
 * @query {string} status - Filter by status
 * @query {string} shadeCode - Filter by shade
 * @returns {Array} Batches for product
 */
router.get('/by-product/:productId', requireAuth, batchTrackingController.getBatchesByProduct);

/**
 * Get batches by shade
 * @route GET /api/batches/by-shade/:shadeCode
 * @param {string} shadeCode - Shade code
 * @query {string} productId - Filter by product (optional)
 * @returns {Array} Batches with shade
 */
router.get('/by-shade/:shadeCode', requireAuth, batchTrackingController.getBatchesByShade);

/**
 * Update batch status
 * @route PATCH /api/batches/:id/status
 * @param {string} id - Batch ID
 * @param {string} status - New status
 * @returns {Object} Updated batch
 */
router.patch('/:id/status', requireAuth, requireAny('batches'),
  body('status').notEmpty(),
  handleValidationErrors,
  batchTrackingController.updateStatus
);

/**
 * Update quality status
 * @route PATCH /api/batches/:id/quality
 * @param {string} id - Batch ID
 * @param {string} qualityStatus - Quality status
 * @param {string} inspectionNotes - Inspection notes
 * @returns {Object} Updated batch
 */
router.patch('/:id/quality', requireAuth, requireAny('batches'),
  body('qualityStatus').notEmpty(),
  handleValidationErrors,
  batchTrackingController.updateQualityStatus
);

/**
 * Allocate batch to order
 * @route POST /api/batches/:id/allocate
 * @param {string} id - Batch ID
 * @param {string} orderId - Sales or Purchase Order ID
 * @param {number} quantity - Quantity to allocate
 * @param {string} orderType - 'sales' or 'purchase'
 * @returns {Object} Allocation details
 */
router.post('/:id/allocate', requireAuth, requireAny('batches'),
  body('orderId').notEmpty(),
  body('quantity').isNumeric(),
  body('orderType').notEmpty(),
  handleValidationErrors,
  batchTrackingController.allocateBatch
);

/**
 * Get allocations for batch
 * @route GET /api/batches/:id/allocations
 * @param {string} id - Batch ID
 * @returns {Array} Allocations
 */
router.get('/:id/allocations', requireAuth, batchTrackingController.getBatchAllocations);

/**
 * Update allocation status
 * @route PATCH /api/batches/allocations/:allocationId/status
 * @param {string} allocationId - Allocation ID
 * @param {string} status - New status
 * @param {number} quantity - Quantity for this status (picked/shipped/delivered)
 * @returns {Object} Updated allocation
 */
router.patch('/allocations/:allocationId/status', requireAuth, requireAny('batches'),
  body('status').notEmpty(),
  handleValidationErrors,
  batchTrackingController.updateAllocationStatus
);

/**
 * Get batch inventory summary
 * @route GET /api/batches/summary/inventory
 * @query {string} productId - Filter by product
 * @query {string} warehouseLocation - Filter by warehouse
 * @returns {Object} Inventory summary
 */
router.get('/summary/inventory', requireAuth, batchTrackingController.getInventorySummary);

/**
 * Get shade availability
 * @route GET /api/batches/availability/shades
 * @query {string} productId - Filter by product
 * @returns {Array} Available shades with quantities
 */
router.get('/availability/shades', requireAuth, batchTrackingController.getShadeAvailability);

module.exports = router;
