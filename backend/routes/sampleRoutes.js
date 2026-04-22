/**
 * Sample Management Routes
 * @module routes/sampleRoutes
 * @description Endpoints for managing sample requests, shipments, and feedback
 * @requires express
 * @requires ../controllers/sampleController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 */

const express = require('express');
const router = express.Router();
const sampleController = require('../controllers/sampleController');
const { requireAuth, requireAny } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');

/**
 * Create new sample request
 * @route POST /api/samples/requests
 * @param {string} customerId - Customer ID
 * @param {Array} products - Array of product objects with quantity
 * @param {date} requiredByDate - Required delivery date
 * @returns {Object} Created sample request
 */
router.post('/requests', requireAuth, requireAny('samples'),
  body('customerId').notEmpty(),
  body('products').isArray(),
  handleValidationErrors,
  sampleController.createRequest
);

/**
 * Get all sample requests
 * @route GET /api/samples/requests
 * @query {string} customerId - Filter by customer
 * @query {string} status - Filter by status
 * @returns {Array} Array of sample requests
 */
router.get('/requests', requireAuth, sampleController.getRequests);

/**
 * Get sample request by ID
 * @route GET /api/samples/requests/:id
 * @param {string} id - Sample request ID
 * @returns {Object} Sample request details
 */
router.get('/requests/:id', requireAuth, sampleController.getRequestById);

/**
 * Update sample request
 * @route PUT /api/samples/requests/:id
 * @param {string} id - Sample request ID
 * @returns {Object} Updated sample request
 */
router.put('/requests/:id', requireAuth, requireAny('samples'),
  sampleController.updateRequest
);

/**
 * Approve sample request
 * @route PATCH /api/samples/requests/:id/approve
 * @param {string} id - Sample request ID
 * @returns {Object} Updated sample request
 */
router.patch('/requests/:id/approve', requireAuth, requireAny('samples'),
  sampleController.approveRequest
);

/**
 * Cancel sample request
 * @route PATCH /api/samples/requests/:id/cancel
 * @param {string} id - Sample request ID
 * @returns {Object} Updated sample request
 */
router.patch('/requests/:id/cancel', requireAuth, requireAny('samples'),
  body('reason').notEmpty(),
  handleValidationErrors,
  sampleController.cancelRequest
);

/**
 * Create sample shipment
 * @route POST /api/samples/requests/:id/ship
 * @param {string} id - Sample request ID
 * @param {string} carrier - Carrier name
 * @param {string} trackingNumber - Tracking number
 * @param {date} expectedDeliveryDate - Expected delivery date
 * @returns {Object} Created shipment
 */
router.post('/requests/:id/ship', requireAuth, requireAny('samples'),
  body('carrier').notEmpty(),
  body('trackingNumber').notEmpty(),
  handleValidationErrors,
  sampleController.shipRequest
);

/**
 * Get all shipments
 * @route GET /api/samples/shipments
 * @query {string} sampleRequestId - Filter by sample request
 * @query {string} status - Filter by status
 * @returns {Array} Array of shipments
 */
router.get('/shipments', requireAuth, sampleController.getShipments);

/**
 * Get shipment by ID
 * @route GET /api/samples/shipments/:id
 * @param {string} id - Shipment ID
 * @returns {Object} Shipment details
 */
router.get('/shipments/:id', requireAuth, sampleController.getShipmentById);

/**
 * Update shipment tracking
 * @route PATCH /api/samples/shipments/:id/track
 * @param {string} id - Shipment ID
 * @param {string} status - New status
 * @param {date} deliveryDate - Actual delivery date (if delivered)
 * @returns {Object} Updated shipment
 */
router.patch('/shipments/:id/track', requireAuth, requireAny('samples'),
  body('status').notEmpty(),
  handleValidationErrors,
  sampleController.updateShipmentTracking
);

/**
 * Submit sample feedback
 * @route POST /api/samples/requests/:id/feedback
 * @param {string} id - Sample request ID
 * @param {number} rating - Overall rating (1-5)
 * @param {string} comments - Customer comments
 * @param {Array} issues - Array of issues found
 * @returns {Object} Created feedback
 */
router.post('/requests/:id/feedback', requireAuth,
  body('rating').isInt({ min: 1, max: 5 }),
  handleValidationErrors,
  sampleController.submitFeedback
);

/**
 * Get feedback
 * @route GET /api/samples/feedback
 * @query {string} sampleRequestId - Filter by sample request
 * @query {string} status - Filter by status
 * @returns {Array} Array of feedback
 */
router.get('/feedback', requireAuth, sampleController.getFeedback);

/**
 * Get feedback by ID
 * @route GET /api/samples/feedback/:id
 * @param {string} id - Feedback ID
 * @returns {Object} Feedback details
 */
router.get('/feedback/:id', requireAuth, sampleController.getFeedbackById);

/**
 * Update feedback status
 * @route PATCH /api/samples/feedback/:id/status
 * @param {string} id - Feedback ID
 * @param {string} status - New status
 * @returns {Object} Updated feedback
 */
router.patch('/feedback/:id/status', requireAuth, requireAny('samples'),
  body('status').notEmpty(),
  handleValidationErrors,
  sampleController.updateFeedbackStatus
);

/**
 * Get sample statistics
 * @route GET /api/samples/statistics
 * @query {date} startDate - Start date for statistics
 * @query {date} endDate - End date for statistics
 * @returns {Object} Statistics data
 */
router.get('/statistics', requireAuth, sampleController.getStatistics);

module.exports = router;
