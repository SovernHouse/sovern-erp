/**
 * Documents Module
 * Provides document management functionality: PDF, Export, Backup
 */

async function initDocuments(app, sequelize, models, registry) {
  // Register documents routes
  const pdfRoutes = require('../../routes/pdfRoutes');
  const exportRoutes = require('../../routes/exportRoutes');
  const backupRoutes = require('../../routes/backupRoutes');

  app.use('/api/pdf', pdfRoutes);
  app.use('/api/exports', exportRoutes);
  app.use('/api/backups', backupRoutes);

  // Register documents models
  registry.registerModel('documents', 'Document', models.Document);
}

module.exports = initDocuments;
