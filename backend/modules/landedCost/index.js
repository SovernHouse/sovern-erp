/**
 * Landed Cost Calculator Module
 * Provides landed cost calculation functionality
 */

async function initLandedCost(app, sequelize, models, registry) {
  // Register landed cost routes
  const landedCostRoutes = require('../../routes/landedCostRoutes');

  app.use('/api/landed-cost', landedCostRoutes);

  // Register landed cost models
  registry.registerModel('landedCost', 'LandedCostTemplate', models.LandedCostTemplate);
  registry.registerModel('landedCost', 'LandedCostCalculation', models.LandedCostCalculation);
}

module.exports = initLandedCost;
