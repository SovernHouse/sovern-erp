/**
 * Chatter Module
 * Polymorphic message thread on every ERP record.
 * Provides comments, system events, status changes, and activity logs.
 */

async function initChatter(app, sequelize, models, registry) {
  try {
    const chatterRoutes = require('../../routes/chatterRoutes');
    app.use('/api/chatter', chatterRoutes);

    registry.registerModel('chatter', 'ChatterMessage', models.ChatterMessage);
    console.log('Chatter module: routes and model registered');
  } catch (error) {
    console.warn('Chatter module initialization warning:', error.message);
  }
}

module.expor