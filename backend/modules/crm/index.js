/**
 * CRM Module
 * Provides customer relationship management: Customers, Contacts, Leads, Deals, Campaigns
 */

async function initCRM(app, sequelize, models, registry) {
  try {
    // Register CRM routes
    const customerRoutes = require('../../routes/customerRoutes');
    const crmRoutes = require('../../routes/crm');
const logger = require('../../utils/logger.js');

    app.use('/api/customers', customerRoutes);
    app.use('/api/crm', crmRoutes);

    // Register CRM models
    registry.registerModel('crm', 'Customer', models.Customer);
    registry.registerModel('crm', 'Contact', models.Contact);
    registry.registerModel('crm', 'Lead', models.Lead);
    registry.registerModel('crm', 'Deal', models.Deal);
    registry.registerModel('crm', 'Campaign', models.Campaign);
    registry.registerModel('crm', 'Activity', models.Activity);
  } catch (error) {
    logger.warn('CRM module initialization warning:', error.message);
    // Continue initialization despite non-critical errors
  }
}

