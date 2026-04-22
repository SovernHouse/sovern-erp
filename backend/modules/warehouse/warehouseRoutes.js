/**
 * Warehouse Management Routes
 * Endpoints for location management, stock operations, and inventory control
 */

const express = require('express');
const router = express.Router();
const warehouseController = require('../../controllers/warehouseController');
const { requireAuth, requireRole, requireAny } = require('../../middleware/auth');

/**
 * Warehouse Location Management
 */

/**
 * POST /api/warehouse/locations
 * Create a new warehouse location
 */
router.post('/locations', requireAuth, requireRole('ADMIN'), warehouseController.createLocation);

/**
 * GET /api/warehouse/locations
 * List warehouse locations with filters
 */
router.get('/locations', requireAuth, requireAny('warehouse'), warehouseController.listLocations);

/**
 * GET /api/warehouse/locations/:id
 * Get a specific warehouse location with current contents
 */
router.get('/locations/:id', requireAuth, requireAny('warehouse'), warehouseController.getLocation);

/**
 * PUT /api/warehouse/locations/:id
 * Update a warehouse location
 */
router.put('/locations/:id', requireAuth, requireRole('ADMIN'), warehouseController.updateLocation);

/**
 * Goods Receiving & Putaway
 */

/**
 * POST /api/warehouse/receive
 * Record goods receipt into receiving zone
 */
router.post('/receive', requireAuth, requireAny('warehouse'), warehouseController.receiveGoods);

/**
 * POST /api/warehouse/putaway
 * Move goods from receiving to storage location
 */
router.post('/putaway', requireAuth, requireAny('warehouse'), warehouseController.putaway);

/**
 * Order Picking & Packing
 */

/**
 * POST /api/warehouse/pick
 * Generate pick list for an order (FIFO allocation)
 */
router.post('/pick', requireAuth, requireAny('warehouse'), warehouseController.pickOrder);

/**
 * POST /api/warehouse/pack
 * Record packing of picked items
 */
router.post('/pack', requireAuth, requireAny('warehouse'), warehouseController.packOrder);

/**
 * Stock Operations
 */

/**
 * POST /api/warehouse/transfer
 * Transfer stock between locations
 */
router.post('/transfer', requireAuth, requireAny('warehouse'), warehouseController.transferStock);

/**
 * POST /api/warehouse/adjust
 * Manual stock adjustment (damage, returns, corrections)
 */
router.post('/adjust', requireAuth, requireAny('warehouse'), warehouseController.adjustStock);

/**
 * Stock Count & Inventory
 */

/**
 * POST /api/warehouse/stock-count/start
 * Start stock count for a zone/warehouse
 */
router.post('/stock-count/start', requireAuth, requireAny('warehouse'), warehouseController.startStockCount);

/**
 * POST /api/warehouse/stock-count/:id/record
 * Record physical count result for a location
 */
router.post('/stock-count/:id/record', requireAuth, requireAny('warehouse'), warehouseController.recordCountResult);

/**
 * POST /api/warehouse/stock-count/:id/complete
 * Complete stock count and generate variance report
 */
router.post('/stock-count/:id/complete', requireAuth, requireAny('warehouse'), warehouseController.completeStockCount);

/**
 * GET /api/warehouse/inventory
 * Get inventory by location with utilization stats
 */
router.get('/inventory', requireAuth, requireAny('warehouse'), warehouseController.getInventoryByLocation);

/**
 * Dashboard & Reporting
 */

/**
 * GET /api/warehouse/dashboard
 * Get warehouse dashboard with key metrics
 */
router.get('/dashboard', requireAuth, requireAny('warehouse'), warehouseController.getWarehouseDashboard);

/**
 * Health check endpoint
 */
router.get('/status', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'operational',
      module: 'Warehouse Management',
      version: '1.0.0'
    }
  });
});

module.exports = router;
