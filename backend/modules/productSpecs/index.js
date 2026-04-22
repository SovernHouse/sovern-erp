/**
 * Product Specifications Module
 * Provides tile-specific product specification management
 */

async function initProductSpecs(app, sequelize, models, registry) {
  // Register product specs routes
  const productSpecsRoutes = require('../../routes/productSpecsRoutes');

  app.use('/api/products', productSpecsRoutes);

  // Register product specs models
  registry.registerModel('productSpecs', 'ProductSpecification', models.ProductSpecification);
}

module.exports = initProductSpecs;
