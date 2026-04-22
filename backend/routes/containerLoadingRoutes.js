/**
 * Container Loading Routes
 * @module routes/containerLoadingRoutes
 * @description Endpoints for container loading optimization and management
 * @requires express
 * @requires ../controllers/containerLoadingController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 */

const express = require('express');
const router = express.Router();
const containerLoadingController = require('../controllers/containerLoadingController');
const { requireAuth, requireAny } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');

/**
 * Get container types
 * @route GET /api/container-loading/container-types
 * @returns {Array} Available container types with specifications
 */
router.get('/container-types', requireAuth, containerLoadingController.getContainerTypes);

/**
 * Get container configuration by type
 * @route GET /api/container-loading/container-types/:type
 * @param {string} type - Container type (20ft, 40ft, 40ft_hc)
 * @returns {Object} Container configuration
 */
router.get('/container-types/:type', requireAuth, containerLoadingController.getContainerTypeConfig);

/**
 * Optimize container loading
 * @route POST /api/container-loading/optimize
 * @param {string} containerType - Container type (20ft, 40ft, 40ft_hc)
 * @param {Array} items - Array of items to load (productBatchId, quantity, palletInfo)
 * @param {number} maxWeight - Maximum weight limit (optional)
 * @returns {Object} Optimization result with loading plan and utilization metrics
 */
router.post('/optimize', requireAuth, requireAny('container-loading'),
  body('containerType').notEmpty(),
  body('items').isArray(),
  handleValidationErrors,
  containerLoadingController.optimizeLoading
);

/**
 * Calculate loading plan
 * @route POST /api/container-loading/calculate
 * @param {string} containerType - Container type
 * @param {Array} items - Items to load
 * @returns {Object} Detailed loading calculation
 */
router.post('/calculate', requireAuth, requireAny('container-loading'),
  body('containerType').notEmpty(),
  body('items').isArray(),
  handleValidationErrors,
  containerLoadingController.calculateLoading
);

/**
 * Get all containers
 * @route GET /api/container-loading/containers
 * @query {string} status - Filter by status
 * @query {string} type - Filter by type
 * @returns {Array} Array of containers
 */
router.get('/containers', requireAuth, containerLoadingController.getContainers);

/**
 * Get container by ID
 * @route GET /api/container-loading/containers/:id
 * @param {string} id - Container ID
 * @returns {Object} Container details
 */
router.get('/containers/:id', requireAuth, containerLoadingController.getContainerById);

/**
 * Create container
 * @route POST /api/container-loading/containers
 * @param {string} containerNumber - Container number
 * @param {string} containerType - Container type
 * @param {string} purchaseOrderId - Purchase order ID
 * @returns {Object} Created container
 */
router.post('/containers', requireAuth, requireAny('container-loading'),
  body('containerNumber').notEmpty(),
  body('containerType').notEmpty(),
  handleValidationErrors,
  containerLoadingController.createContainer
);

/**
 * Update container
 * @route PUT /api/container-loading/containers/:id
 * @param {string} id - Container ID
 * @returns {Object} Updated container
 */
router.put('/containers/:id', requireAuth, requireAny('container-loading'),
  containerLoadingController.updateContainer
);

/**
 * Update container status
 * @route PATCH /api/container-loading/containers/:id/status
 * @param {string} id - Container ID
 * @param {string} status - New status
 * @returns {Object} Updated container
 */
router.patch('/containers/:id/status', requireAuth, requireAny('container-loading'),
  body('status').notEmpty(),
  handleValidationErrors,
  containerLoadingController.updateContainerStatus
);

/**
 * Add items to container
 * @route POST /api/container-loading/containers/:id/add-items
 * @param {string} id - Container ID
 * @param {Array} items - Items to add
 * @returns {Object} Updated container
 */
router.post('/containers/:id/add-items', requireAuth, requireAny('container-loading'),
  body('items').isArray(),
  handleValidationErrors,
  containerLoadingController.addItemsToContainer
);

/**
 * Generate loading manifest
 * @route GET /api/container-loading/containers/:id/manifest
 * @param {string} id - Container ID
 * @returns {Object} Loading manifest PDF or JSON
 */
router.get('/containers/:id/manifest', requireAuth, containerLoadingController.getManifest);

/**
 * Get loading recommendations
 * @route POST /api/container-loading/recommendations
 * @param {Array} items - Items to load
 * @param {number} maxContainers - Maximum containers to use
 * @returns {Array} Recommended loading configurations
 */
router.post('/recommendations', requireAuth, requireAny('container-loading'),
  body('items').isArray(),
  handleValidationErrors,
  containerLoadingController.getLoadingRecommendations
);

/**
 * Calculate utilization metrics
 * @route POST /api/container-loading/utilization
 * @param {string} containerType - Container type
 * @param {Array} items - Items loaded
 * @returns {Object} Utilization metrics (weight, volume, space)
 */
router.post('/utilization', requireAuth, requireAny('container-loading'),
  body('containerType').notEmpty(),
  body('items').isArray(),
  handleValidationErrors,
  containerLoadingController.calculateUtilization
);

/**
 * Get container statistics
 * @route GET /api/container-loading/statistics
 * @query {date} startDate - Start date
 * @query {date} endDate - End date
 * @returns {Object} Statistics on container usage and optimization
 */
router.get('/statistics', requireAuth, containerLoadingController.getStatistics);

module.exports = router;
