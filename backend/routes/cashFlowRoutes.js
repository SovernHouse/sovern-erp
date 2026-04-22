/**
 * Cash Flow Forecasting Routes
 * @module routes/cashFlowRoutes
 * @description Endpoints for cash flow analysis, aging reports, and financial forecasting
 * @requires express
 * @requires ../middleware/auth
 * @requires ../controllers/cashFlowController
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const cashFlowController = require('../controllers/cashFlowController');

/**
 * Get cash flow forecast for next N days
 * @route GET /api/cash-flow/forecast
 * @param {number} days - Number of days to forecast (30, 60, or 90)
 * @param {string} groupBy - Grouping period: daily, weekly, monthly (default: daily)
 */
router.get('/forecast', requireAuth, requireRole('admin', 'finance'), cashFlowController.getForecast);

/**
 * Get aged receivables report
 * @route GET /api/cash-flow/aged-receivables
 */
router.get('/aged-receivables', requireAuth, requireRole('admin', 'finance'), cashFlowController.getAgedReceivables);

/**
 * Get aged payables report
 * @route GET /api/cash-flow/aged-payables
 */
router.get('/aged-payables', requireAuth, requireRole('admin', 'finance'), cashFlowController.getAgedPayables);

/**
 * Get cash flow summary
 * @route GET /api/cash-flow/summary
 */
router.get('/summary', requireAuth, requireRole('admin', 'finance'), cashFlowController.getCashFlowSummary);

module.exports = router;
