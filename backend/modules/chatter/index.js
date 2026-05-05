/**
 * Chatter Module
 * Polymorphic message thread on every ERP record.
 * Provides comments, system events, status changes, and activity logs.
 */

async function initChatter(app, sequelize, models, registry) {
  try {
    const chatterRoutes = require('../../routes/chatterRoutes');
const logger = require('../../utils/logger.js');
    app.use('/api/chatter', chatterRoutes);

    registry.registerModel('chatter', 'ChatterMessage', models.ChatterMessage);
    logger.info('Chatter module: routes and model registered');
  } catch (error) {
    logger.warn('Chatter module initialization warning:', error.message);
  }
}

module.expor