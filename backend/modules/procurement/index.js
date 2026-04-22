/**
 * Procurement Module
 * Provides procurement functionality: Purchase Orders, Factory Management
 */

async function initProcurement(app, sequelize, models, registry) {
  // Register procurement routes
  const purchaseOrderRoutes = require('../../routes/purchaseOrderRoutes');
  const factoryRoutes = require('../../routes/factoryRoutes');
  const factoryPortalRoutes = require('../../routes/factoryPortalRoutes');

  app.use('/api/purchase-orders', purchaseOrderRoutes);
  app.use('/api/factories', factoryRoutes);
  app.use('/api/factory', factoryPortalRoutes);

  // Register procurement models
  registry.registerModel('procurement', 'PurchaseOrder', models.PurchaseOrder);
  registry.registerModel('procurement', 'PurchaseOrderItem', models.PurchaseOrderItem);
  registry.registerModel('procurement', 'Factory', models.Factory);
}

module.exports = initProcurement;
