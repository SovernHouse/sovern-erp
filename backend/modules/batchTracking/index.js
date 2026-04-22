/**
 * Batch & Shade Tracking Module
 * Provides batch tracking and allocation functionality
 */

async function initBatchTracking(app, sequelize, models, registry) {
  // Register batch tracking routes
  const batchTrackingRoutes = require('../../routes/batchTrackingRoutes');

  app.use('/api/batches', batchTrackingRoutes);

  // Register batch tracking models
  registry.registerModel('batchTracking', 'ProductBatch', models.ProductBatch);
  registry.registerModel('batchTracking', 'BatchAllocation', models.BatchAllocation);
}

module.exports = initBatchTracking;
