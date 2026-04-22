/**
 * Currency Service
 * Handles currency conversion and exchange rates
 * Fetches live rates from external API with fallback to hardcoded rates
 */

const https = require('https');
const http = require('http');

// Supported currencies
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY', 'AED', 'INR', 'SAR'];

// Default exchange rates (relative to USD base)
const DEFAULT_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  CNY: 7.24,
  AED: 3.67,
  INR: 83.12,
  SAR: 3.75
};

// In-memory store for rates (in production, this would be cached from DB)
let exchangeRates = { ...DEFAULT_RATES };
let lastUpdated = new Date();
let lastApiError = null;
let scheduledRateUpdateTimer = null;

// Configuration from environment
const EXCHANGE_RATE_API_URL = process.env.EXCHANGE_RATE_API_URL || 'https://api.exchangerate-api.com/v4/latest/USD';
const EXCHANGE_RATE_UPDATE_INTERVAL_MS = parseInt(process.env.EXCHANGE_RATE_UPDATE_INTERVAL_MS || '21600000'); // 6 hours by default

/**
 * Get list of supported currencies
 */
const getSupportedCurrencies = () => {
  return SUPPORTED_CURRENCIES.map(code => ({
    code,
    name: getCurrencyName(code),
    symbol: getCurrencySymbol(code)
  }));
};

/**
 * Get currency name from code
 */
const getCurrencyName = (code) => {
  const names = {
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    CNY: 'Chinese Yuan',
    AED: 'UAE Dirham',
    INR: 'Indian Rupee',
    SAR: 'Saudi Riyal'
  };
  return names[code] || code;
};

/**
 * Get currency symbol
 */
const getCurrencySymbol = (code) => {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CNY: '¥',
    AED: 'د.إ',
    INR: '₹',
    SAR: 'ر.س'
  };
  return symbols[code] || code;
};

/**
 * Get current exchange rates
 */
const getExchangeRates = () => {
  return {
    rates: exchangeRates,
    baseCurrency: 'USD',
    lastUpdated: lastUpdated,
    source: 'manual'
  };
};

/**
 * Convert amount from one currency to another
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {number} Converted amount
 */
const convertAmount = (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  if (!exchangeRates[fromCurrency]) {
    throw new Error(`Unsupported currency: ${fromCurrency}`);
  }

  if (!exchangeRates[toCurrency]) {
    throw new Error(`Unsupported currency: ${toCurrency}`);
  }

  // Convert to USD first, then to target currency
  const amountInUSD = amount / exchangeRates[fromCurrency];
  const convertedAmount = amountInUSD * exchangeRates[toCurrency];

  return parseFloat(convertedAmount.toFixed(2));
};

/**
 * Get formatted amount string
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount (e.g., "$1,234.56")
 */
const getFormattedAmount = (amount, currency) => {
  const symbol = getCurrencySymbol(currency);
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${symbol} ${formatter.format(amount)}`;
};

/**
 * Update exchange rates
 * @param {object} rates - New exchange rates object
 */
const updateExchangeRates = (rates) => {
  if (!rates || typeof rates !== 'object') {
    throw new Error('Invalid rates object');
  }

  // Validate that all provided rates are numbers and positive
  for (const [currency, rate] of Object.entries(rates)) {
    if (typeof rate !== 'number' || rate <= 0) {
      throw new Error(`Invalid rate for ${currency}: must be a positive number`);
    }
  }

  exchangeRates = { ...DEFAULT_RATES, ...rates };
  lastUpdated = new Date();

  return {
    success: true,
    rates: exchangeRates,
    message: 'Exchange rates updated successfully'
  };
};

/**
 * Get exchange rate between two currencies
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @returns {number} Exchange rate
 */
const getExchangeRate = (fromCurrency, toCurrency) => {
  if (!exchangeRates[fromCurrency]) {
    throw new Error(`Unsupported currency: ${fromCurrency}`);
  }

  if (!exchangeRates[toCurrency]) {
    throw new Error(`Unsupported currency: ${toCurrency}`);
  }

  return parseFloat((exchangeRates[toCurrency] / exchangeRates[fromCurrency]).toFixed(6));
};

/**
 * Fetch live exchange rates from external API
 * @returns {Promise<object>} Updated rates object
 */
const fetchLiveRates = async () => {
  return new Promise((resolve, reject) => {
    const url = new URL(EXCHANGE_RATE_API_URL);
    const protocol = url.protocol === 'https:' ? https : http;

    const request = protocol.get(url, { timeout: 10000 }, (response) => {
      let data = '';

      if (response.statusCode !== 200) {
        reject(new Error(`API returned status ${response.statusCode}`));
        return;
      }

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const apiData = JSON.parse(data);

          if (!apiData.rates) {
            reject(new Error('Invalid API response: missing rates field'));
            return;
          }

          // Extract only supported currencies
          const newRates = {};
          for (const currency of SUPPORTED_CURRENCIES) {
            if (apiData.rates[currency]) {
              newRates[currency] = apiData.rates[currency];
            }
          }

          // Ensure USD is always 1.0
          newRates.USD = 1.0;

          // Update in-memory rates
          exchangeRates = newRates;
          lastUpdated = new Date();
          lastApiError = null;

          resolve(newRates);
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error('API request timed out'));
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
};

/**
 * Get historical exchange rate for a specific date
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {Date} date - Date to get rate for
 * @returns {Promise<object>} Historical rate data
 */
const getHistoricalRate = async (fromCurrency, toCurrency, date) => {
  const db = require('../models');

  try {
    // Try to find historical rate in database
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const rate = await db.ExchangeRate.findOne({
      where: {
        baseCurrency: fromCurrency,
        targetCurrency: toCurrency,
        effectiveDate: {
          [require('sequelize').Op.between]: [startOfDay, endOfDay]
        },
        isActive: true
      },
      order: [['effectiveDate', 'DESC']]
    });

    if (!rate) {
      // Return current rate if historical not found
      return {
        fromCurrency,
        toCurrency,
        rate: getExchangeRate(fromCurrency, toCurrency),
        date: new Date(),
        source: 'current',
        message: 'Historical rate not found, returning current rate'
      };
    }

    return {
      fromCurrency,
      toCurrency,
      rate: parseFloat(rate.rate),
      date: rate.effectiveDate,
      source: 'historical'
    };
  } catch (error) {
    console.error('Error fetching historical rate:', error);
    // Gracefully fallback to current rate
    return {
      fromCurrency,
      toCurrency,
      rate: getExchangeRate(fromCurrency, toCurrency),
      date: new Date(),
      source: 'current',
      error: error.message
    };
  }
};

/**
 * Start scheduled rate updates
 * Fetches new rates at specified intervals
 */
const startScheduledRateUpdate = () => {
  if (scheduledRateUpdateTimer) {
    return; // Already running
  }

  // Initial fetch on startup
  fetchLiveRates()
    .then(() => {
      console.log('Initial exchange rates fetched successfully');
      // Persist to database
      persistRatesToDatabase().catch(err => console.error('Error persisting rates:', err));
    })
    .catch(error => {
      console.warn('Failed to fetch initial exchange rates, using defaults:', error.message);
      lastApiError = error.message;
    });

  // Schedule periodic updates
  scheduledRateUpdateTimer = setInterval(() => {
    fetchLiveRates()
      .then(() => {
        console.log('Exchange rates updated successfully');
        // Persist to database
        persistRatesToDatabase().catch(err => console.error('Error persisting rates:', err));
      })
      .catch(error => {
        console.warn('Failed to update exchange rates:', error.message);
        lastApiError = error.message;
      });
  }, EXCHANGE_RATE_UPDATE_INTERVAL_MS);
};

/**
 * Stop scheduled rate updates
 */
const stopScheduledRateUpdate = () => {
  if (scheduledRateUpdateTimer) {
    clearInterval(scheduledRateUpdateTimer);
    scheduledRateUpdateTimer = null;
  }
};

/**
 * Persist current rates to database
 * @private
 */
const persistRatesToDatabase = async () => {
  const db = require('../models');
  const { v4: uuidv4 } = require('uuid');

  try {
    for (const [currency, rate] of Object.entries(exchangeRates)) {
      if (currency !== 'USD') {
        // Use findOne + create/update pattern instead of upsert due to unique constraint on (base_currency, target_currency)
        const existingRate = await db.ExchangeRate.findOne({
          where: {
            baseCurrency: 'USD',
            targetCurrency: currency
          }
        });

        if (existingRate) {
          // Update existing rate
          await existingRate.update({
            rate: parseFloat(rate),
            source: 'api',
            effectiveDate: new Date(),
            isActive: true
          });
        } else {
          // Create new rate
          await db.ExchangeRate.create({
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
    }
  } catch (error) {
    console.error('Failed to persist rates to database:', error);
    throw error;
  }
};

/**
 * Get API status information
 */
const getApiStatus = () => {
  return {
    apiUrl: EXCHANGE_RATE_API_URL,
    updateInterval: EXCHANGE_RATE_UPDATE_INTERVAL_MS,
    lastUpdated: lastUpdated,
    lastApiError: lastApiError,
    isScheduled: !!scheduledRateUpdateTimer,
    currentRates: exchangeRates
  };
};

module.exports = {
  getSupportedCurrencies,
  getCurrencyName,
  getCurrencySymbol,
  getExchangeRates,
  convertAmount,
  getFormattedAmount,
  updateExchangeRates,
  getExchangeRate,
  fetchLiveRates,
  getHistoricalRate,
  startScheduledRateUpdate,
  stopScheduledRateUpdate,
  getApiStatus,
  SUPPORTED_CURRENCIES,
  DEFAULT_RATES
};
