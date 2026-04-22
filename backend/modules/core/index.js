/**
 * Core Module
 * Provides core platform functionality: Auth, Users, RBAC, Settings, Audit, Notifications
 */

async function initCore(app, sequelize, models, registry) {
  // Register core routes
  const authRoutes = require('../../routes/authRoutes');
  const userRoutes = require('../../routes/userRoutes');
  const settingsRoutes = require('../../routes/settingsRoutes');
  const auditRoutes = require('../../routes/auditRoutes');

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/audit-logs', auditRoutes);

  // Register core models
  registry.registerModel('core', 'User', models.User);
  registry.registerModel('core', 'AuditLog', models.AuditLog);
}

module.exports = initCore;
