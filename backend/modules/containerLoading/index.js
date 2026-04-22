/**
 * Container Loading Module
 * Provides container loading optimization and management
 */

async function initContainerLoading(app, sequelize, models, registry) {
  // Register container loading routes
  const containerLoadingRoutes = require('../../routes/containerLoadingRoutes');

  app.use('/api/container-loading', containerLoadingRoutes);

  // Register container loading models
  registry.registerModel('containerLoading', 'Container', models.Container);
  registry.registerModel('containerLoading', 'ContainerConfiguration', models.ContainerConfiguration);
}

module.exports = initContainerLoading;
