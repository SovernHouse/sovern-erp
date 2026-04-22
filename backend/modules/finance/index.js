/**
 * Finance Module
 * Provides finance functionality: Invoices, Payments, Currency
 */

async function initFinance(app, sequelize, models, registry) {
  // Register finance routes
  const invoiceRoutes = require('../../routes/invoiceRoutes');
  const paymentRoutes = require('../../routes/paymentRoutes');
  const currencyRoutes = require('../../routes/currencyRoutes');

  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/currencies', currencyRoutes);

  // Register finance models
  registry.registerModel('finance', 'Invoice', models.Invoice);
  registry.registerModel('finance', 'Payment', models.Payment);
  registry.registerModel('finance', 'ExchangeRate', models.ExchangeRate);
}

module.exports = initFinance;
