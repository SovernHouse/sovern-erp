const express = require('express');
const router = express.Router();
const { requireAuth: authenticate } = require('../middleware/auth');
const bankIntegrationService = require('../services/bankIntegrationService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * Bank Integration Routes
 * All endpoints require authentication
 */

/**
 * POST /api/bank/lc/apply
 * Submit LC application to bank
 */
router.post(
  '/lc/apply',
  authenticate,
  asyncHandler(async (req, res) => {
    const lcData = req.body;

    // Validate required fields
    if (!lcData.lcAmount || !lcData.currency || !lcData.buyerBankCode) {
      return res.status(400).json({
        error: 'Missing required fields: lcAmount, currency, buyerBankCode',
      });
    }

    const result = await bankIntegrationService.submitLCApplication(lcData);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  })
);

/**
 * GET /api/bank/lc/:reference/status
 * Check LC status with bank
 */
router.get(
  '/lc/:reference/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        error: 'Bank reference is required',
      });
    }

    const result = await bankIntegrationService.checkLCStatus(reference);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  })
);

/**
 * POST /api/bank/lc/:reference/documents
 * Submit documents for LC negotiation
 */
router.post(
  '/lc/:reference/documents',
  authenticate,
  asyncHandler(async (req, res) => {
    const { reference } = req.params;
    const { documents } = req.body;

    if (!reference) {
      return res.status(400).json({
        error: 'Bank reference is required',
      });
    }

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({
        error: 'Documents array is required',
      });
    }

    const result = await bankIntegrationService.submitDocuments(reference, documents);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  })
);

/**
 * POST /api/bank/lc/:reference/amend
 * Request LC amendment
 */
router.post(
  '/lc/:reference/amend',
  authenticate,
  asyncHandler(async (req, res) => {
    const { reference } = req.params;
    const { amendments } = req.body;

    if (!reference) {
      return res.status(400).json({
        error: 'Bank reference is required',
      });
    }

    if (!amendments) {
      return res.status(400).json({
        error: 'Amendment details are required',
      });
    }

    const result = await bankIntegrationService.requestLCAmendment(reference, amendments);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  })
);

/**
 * GET /api/bank/lc/:reference/advice
 * Get LC advice/notification
 */
router.get(
  '/lc/:reference/advice',
  authenticate,
  asyncHandler(async (req, res) => {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        error: 'Bank reference is required',
      });
    }

    const result = await bankIntegrationService.getLCAdvice(reference);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  })
);

/**
 * POST /api/bank/charges/estimate
 * Estimate bank charges for an LC
 */
router.post(
  '/charges/estimate',
  authenticate,
  asyncHandler(async (req, res) => {
    const { lcAmount, currency, bankCode } = req.body;

    if (!lcAmount || !currency || !bankCode) {
      return res.status(400).json({
        error: 'Missing required fields: lcAmount, currency, bankCode',
      });
    }

    if (typeof lcAmount !== 'number' || lcAmount <= 0) {
      return res.status(400).json({
        error: 'lcAmount must be a positive number',
      });
    }

    const result = await bankIntegrationService.getBankCharges(lcAmount, currency, bankCode);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

module.exports = router;
