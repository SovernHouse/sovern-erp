/**
 * Analytics Module
 * Provides analytics functionality: Dashboards, Reports, Analytics, Monitoring
 */

async function initAnalytics(app, sequelize, models, registry) {
  // Register analytics routes
  const dashboardRoutes = require('../../routes/dashboardRoutes');
  const reportRoutes = require('../../routes/reportRoutes');
  const analyticsRoutes = require('../../routes/analyticsRoutes');
  const monitoringRoutes = require('../../routes/monitoringRoutes');

  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/monitoring', monitoringRoutes);
}

module.exports = initAnalytics;
