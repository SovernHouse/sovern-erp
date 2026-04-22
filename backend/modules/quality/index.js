/**
 * Quality Module
 * Provides quality functionality: Inspections, Claims
 */

async function initQuality(app, sequelize, models, registry) {
  // Register quality routes
  const inspectionRoutes = require('../../routes/inspectionRoutes');
  const claimRoutes = require('../../routes/claimRoutes');

  app.use('/api/inspections', inspectionRoutes);
  app.use('/api/claims', claimRoutes);

  // Register quality models
  registry.registerModel('quality', 'Inspection', models.Inspection);
  registry.registerModel('quality', 'InspectionItem', models.InspectionItem);
  registry.registerModel('quality', 'InspectionReport', models.InspectionReport);
  registry.registerModel('quality', 'Claim', models.Claim);
}

module.exports = initQuality;
