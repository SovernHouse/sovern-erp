/**
 * Logistics Module
 * Provides logistics functionality: Shipments, Packing Lists, Tracking
 */

async function initLogistics(app, sequelize, models, registry) {
  // Register logistics routes
  const shipmentRoutes = require('../../routes/shipmentRoutes');
  const packingListRoutes = require('../../routes/packingListRoutes');
  const shippingDocumentRoutes = require('../../routes/shippingDocumentRoutes');

  app.use('/api/shipments', shipmentRoutes);
  app.use('/api/packing-lists', packingListRoutes);
  app.use('/api/shipping-documents', shippingDocumentRoutes);

  // Register logistics models
  registry.registerModel('logistics', 'Shipment', models.Shipment);
  registry.registerModel('logistics', 'ShipmentTracking', models.ShipmentTracking);
  registry.registerModel('logistics', 'PackingList', models.PackingList);
  registry.registerModel('logistics', 'PackingListItem', models.PackingListItem);
  registry.registerModel('logistics', 'ShippingDocument', models.ShippingDocument);
}

module.exports = initLogistics;
