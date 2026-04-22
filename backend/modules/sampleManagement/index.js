/**
 * Sample Management Module
 * Provides sample management functionality: request, shipment, and feedback tracking
 */

async function initSampleManagement(app, sequelize, models, registry) {
  // Register sample management routes
  const sampleRoutes = require('../../routes/sampleRoutes');

  app.use('/api/samples', sampleRoutes);

  // Register sample management models
  registry.registerModel('sampleManagement', 'SampleRequest', models.SampleRequest);
  registry.registerModel('sampleManagement', 'SampleShipment', models.SampleShipment);
  registry.registerModel('sampleManagement', 'SampleFeedback', models.SampleFeedback);
}

module.exports = initSampleManagement;
