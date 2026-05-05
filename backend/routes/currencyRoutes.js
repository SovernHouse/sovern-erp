const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSuccessResponse } = require('../utils/helpers');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const currencyService = require('../services/currencyService');
const { v4: uuidv4 } = require('uuid');
const auditService = require('../services/auditService');
const logger = require('../utils/logger.js');

/**
 * GET /api/currencies
 * List all supported currencies
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const currencies = currencyService.getSupportedCurrencies();
    res.json(getSuccessResponse(currencies, 'Supported currencies retrieved'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/currencies/rates
 * Get current exchange rates
 */
router.get('/rates', requireAuth, async (req, res, next) => {
  try {
    const rates = currencyService.getExchangeRates();
    res.json(getSuccessResponse(rates, 'Exchange rates retrieved'));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/currencies/rates
 * Update exchange rates (admin only)
 */
router.post('/rates', requireAuth, requireRole('admin', 'finance'), async (req, res, next) => {
  try {
    const { rates } = req.body;

    if (!rates || typeof rates !== 'object') {
      throw new ValidationError('rates object is required');
    }

    const updated = currencyService.updateExchangeRates(rates);

    // Log to database for audit trail
    try {
      for (const [currency, rate] of Object.entries(rates)) {
        await db.ExchangeRate.upsert({
          id: uuidv4(),
          baseCurrency: 'USD',
          targetCurrency: currency,
          rate: rate,
          source: 'manual',
          effectiveDate: new Date(),
          isActive: true
        });
      }
    } catch (dbError) {
      logger.error('Failed to save rates to database:', dbError);
      // Continue anyway - rates are updated in memory
    }

    res.json(getSuccessResponse(updated, 'Exchange rates updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'ExchangeRates', 'all', { rates }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/currencies/convert
 * Convert amount from one currency to another
 * Query params: amount, from, to
 */
router.get('/convert', requireAuth, async (req, res, next) => {
  try {
    const { amount, from, to } = req.query;

    if (!amount || isNaN(amount)) {
      throw new ValidationError('amount must be a valid number');
    }

    if (!from || !to) {
      throw new ValidationError('from and to currencies are required');
    }

    const sourceAmount = parseFloat(amount);
    const convertedAmount = currencyService.convertAmount(sourceAmount, from.toUpperCase(), to.toUpperCase());
    const rate = currencyService.getExchangeRate(from.toUpperCase(), to.toUpperCase());
    const formattedSource = currencyService.getFormattedAmount(sourceAmount, from.toUpperCase());
    const formattedTarget = currencyService.getFormattedAmount(convertedAmount, to.toUpperCase());

    res.json(getSuccessResponse({
      sourceAmount,
      sourceCurrency: from.toUpperCase(),
      targetAmount: convertedAmount,
      targetCurrency: to.toUpperCase(),
      exchangeRate: rate,
      formattedSource,
      formattedTarget
    }, 'Currency conversion completed'));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/currencies/convert
 * Convert amount from one currency to another (body params)
 */
router.post('/convert', requireAuth, async (req, res, next) => {
  try {
    const { amount, fromCurrency: from, toCurrency: to } = req.body;
    if (!amount || !from || !to) {
      return res.status(400).json({ success: false, error: { message: 'amount, fromCurrency, and toCurrency are required', statusCode: 400 } });
    }
    const sourceAmount = parseFloat(amount);
    const convertedAmount = currencyService.convertAmount(sourceAmount, from.toUpperCase(), to.toUpperCase());
    const rate = currencyService.getExchangeRate(from.toUpperCase(), to.toUpperCase());
    const formattedSource = currencyService.getFormattedAmount(sourceAmount, from.toUpperCase());
    const formattedTarget = currencyService.getFormattedAmount(convertedAmount, to.toUpperCase());
    res.json(getSuccessResponse({
      sourceAmount, sourceCurrency: from.toUpperCase(),
      targetAmount: convertedAmount, targetCurrency: to.toUpperCase(),
      exchangeRate: rate, formattedSource, formattedTarget
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/currencies/live
 * Get latest live exchange rates
 */
router.get('/live', requireAuth, async (req, res, next) => {
  try {
    const rates = currencyService.getExchangeRates();
    const status = currencyService.getApiStatus();

    res.json(getSuccessResponse({
      rates: rates.rates,
      baseCurrency: rates.baseCurrency,
      lastUpdated: rates.lastUpdated,
      source: rates.source,
      apiStatus: {
        isAvailable: !status.lastApiError,
        lastError: status.lastApiError,
        updateInterval: status.updateInterval
      }
    }, 'Live exchange rates retrieved'));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/currencies/refresh
 * Manually trigger exchange rate refresh (admin only)
 */
router.post('/refresh', requireAuth, requireRole('admin', 'finance'), async (req, res, next) => {
  try {
    const rates = await currencyService.fetchLiveRates();

    // Persist to database
    const { v4: uuidv4 } = require('uuid');
    for (const [currency, rate] of Object.entries(rates)) {
      if (currency !== 'USD') {
        await db.ExchangeRate.upsert({
          id: uuidv4(),
          baseCurrency: 'USD',
          targetCurrency: currency,
          rate: parseFloat(rate),
          source: 'api',
          effectiveDate: new Date(),
          isActive: true
        });
      }
    }

    res.json(getSuccessResponse({
      rates,
      message: 'Exchange rates refreshed successfully from API'
    }, 'Rates updated'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'ExchangeRates', 'live-refresh', { source: 'api' }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/currencies/historical
 * Get historical exchange rate
 * Query params: from, to, date
 */
router.get('/historical', requireAuth, async (req, res, next) => {
  try {
    const { from, to, date } = req.query;

    if (!from || !to || !date) {
      throw new ValidationError('from, to, and date query parameters are required');
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new ValidationError('date must be a valid ISO date string');
    }

    const historicalRate = await currencyService.getHistoricalRate(from.toUpperCase(), to.toUpperCase(), targetDate);

    res.json(getSuccessResponse(historicalRate, 'Historical exchange rate retrieved'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/currencies/:code/history
 * Get exchange rate history for a currency
 * Query params: from (base currency, default USD), days (default 30)
 */
router.get('/:code/history', requireAuth, async (req, res, next) => {
  try {
    const targetCode = req.params.code.toUpperCase();
    const baseCurrency = (req.query.from || 'USD').toUpperCase();
    const days = parseInt(req.query.days) || 30;

    // Validate days parameter
    if (isNaN(days) || days < 1 || days > 365) {
      throw new ValidationError('days must be a number between 1 and 365');
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch historical rates from database
    const history = await db.ExchangeRate.findAll({
      where: {
        baseCurrency,
        targetCurrency: targetCode,
        effectiveDate: {
          [db.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['effectiveDate', 'ASC']]
    });

    if (history.length === 0) {
      // Return current rate if no history available
      const currentRate = currencyService.getExchangeRate(baseCurrency, targetCode);
      return res.json(getSuccessResponse({
        baseCurrency,
        targetCurrency: targetCode,
        period: `${days} days`,
        startDate,
        endDate,
        dataPoints: 0,
        rates: [{
          date: new Date(),
          rate: currentRate,
          source: 'current'
        }]
      }, 'Exchange rate history retrieved'));
    }

    res.json(getSuccessResponse({
      baseCurrency,
      targetCurrency: targetCode,
      period: `${days} days`,
      startDate,
      endDate,
      dataPoints: history.length,
      rates: history.map(h => ({
        date: h.effectiveDate,
        rate: parseFloat(h.rate),
        source: h.source,
        isActive: h.isActive
      })),
      summary: {
        highestRate: Math.max(...history.map(h => parseFloat(h.rate))),
        lowestRate: Math.min(...history.map(h => parseFloat(h.rate))),
        averageRate: history.reduce((sum, h) => sum + parseFloat(h.rate), 0) / history.length,
        currentRate: parseFloat(history[history.length - 1].rate),
        changePercent: ((parseFloat(history[history.length - 1].rate) - parseFloat(history[0].rate)) / parseFloat(history[0].rate) * 100).toFixed(2) + '%'
      }
    }, 'Exchange rate history retrieved'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/currencies/:code
 * Get currency details
 */
router.get('/:code', requireAuth, async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const currencies = currencyService.getSupported