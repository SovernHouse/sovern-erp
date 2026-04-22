/**
 * Trade Finance Module
 * Provides trade finance functionality: Letter of Credit (LC) lifecycle management
 */

async function initTradeFinance(app, sequelize, models, registry) {
  // Register trade finance routes
  const letterOfCreditRoutes = require('../../routes/letterOfCreditRoutes');

  app.use('/api/trade-finance/lcs', letterOfCreditRoutes);

  // Register trade finance models
  registry.registerModel('tradeFinance', 'LetterOfCredit', models.LetterOfCredit);
  registry.registerModel('tradeFinance', 'LetterOfCreditDocument', models.LetterOfCreditDocument);
}

module.exports = initTradeFinance;
