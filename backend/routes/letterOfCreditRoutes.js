/**
 * Letter of Credit Management Routes
 * @module routes/letterOfCreditRoutes
 * @description Endpoints for managing Letter of Credit (LC) lifecycle
 * @requires express
 * @requires ../controllers/letterOfCreditController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 */

const express = require('express');
const router = express.Router();
const letterOfCreditController = require('../controllers/letterOfCreditController');
const { requireAuth, requireAny } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');

/**
 * Create a new Letter of Credit
 * @route POST /api/trade-finance/lcs
 * @param {string} lcNumber - LC number
 * @param {string} supplierId - Supplier ID
 * @param {string} customerId - Customer ID
 * @param {string} issuingBank - Issuing bank name
 * @param {number} amount - LC amount
 * @param {string} currency - Currency code
 * @param {date} expiryDate - Expiry date
 * @returns {Object} Created LC object
 */
router.post('/', requireAuth, requireAny('trade-finance'),
  body('lcNumber').notEmpty(),
  body('supplierId').notEmpty(),
  body('customerId').notEmpty(),
  body('issuingBank').notEmpty(),
  body('amount').isNumeric(),
  body('currency').isLength({ min: 3, max: 3 }),
  body('expiryDate').isISO8601(),
  handleValidationErrors,
  letterOfCreditController.create
);

/**
 * Get all Letters of Credit
 * @route GET /api/trade-finance/lcs
 * @query {string} status - Filter by status
 * @query {string} supplierId - Filter by supplier
 * @query {string} customerId - Filter by customer
 * @returns {Array} Array of LCs
 */
router.get('/', requireAuth, letterOfCreditController.getAll);

/**
 * Get LC by ID
 * @route GET /api/trade-finance/lcs/:id
 * @param {string} id - LC ID
 * @returns {Object} LC object
 */
router.get('/:id', requireAuth, letterOfCreditController.getById);

/**
 * Update LC details
 * @route PUT /api/trade-finance/lcs/:id
 * @param {string} id - LC ID
 * @returns {Object} Updated LC object
 */
router.put('/:id', requireAuth, requireAny('trade-finance'),
  letterOfCreditController.update
);

/**
 * Update LC status
 * @route PATCH /api/trade-finance/lcs/:id/status
 * @param {string} id - LC ID
 * @param {string} status - New status
 * @returns {Object} Updated LC object
 */
router.patch('/:id/status', requireAuth, requireAny('trade-finance'),
  body('status').notEmpty(),
  handleValidationErrors,
  letterOfCreditController.updateStatus
);

/**
 * Amend LC
 * @route PATCH /api/trade-finance/lcs/:id/amend
 * @param {string} id - LC ID
 * @param {Object} amendments - Amendment details
 * @returns {Object} Updated LC object
 */
router.patch('/:id/amend', requireAuth, requireAny('trade-finance'),
  body('amendments').notEmpty(),
  handleValidationErrors,
  letterOfCreditController.amend
);

/**
 * Submit LC for approval
 * @route POST /api/trade-finance/lcs/:id/submit
 * @param {string} id - LC ID
 * @returns {Object} Updated LC object
 */
router.post('/:id/submit', requireAuth, requireAny('trade-finance'),
  letterOfCreditController.submit
);

/**
 * Present documents for LC
 * @route POST /api/trade-finance/lcs/:id/present-documents
 * @param {string} id - LC ID
 * @param {Array} documents - Document details
 * @returns {Object} Updated LC object
 */
router.post('/:id/present-documents', requireAuth, requireAny('trade-finance'),
  body('documents').isArray(),
  handleValidationErrors,
  letterOfCreditController.presentDocuments
);

/**
 * Settle/Pay LC
 * @route POST /api/trade-finance/lcs/:id/settle
 * @param {string} id - LC ID
 * @param {number} amount - Settlement amount
 * @returns {Object} Updated LC object
 */
router.post('/:id/settle', requireAuth, requireAny('trade-finance'),
  body('amount').isNumeric(),
  handleValidationErrors,
  letterOfCreditController.settle
);

/**
 * Get LC documents
 * @route GET /api/trade-finance/lcs/:id/documents
 * @param {string} id - LC ID
 * @returns {Array} Array of documents
 */
router.get('/:id/documents', requireAuth, letterOfCreditController.getDocuments);

/**
 * Upload document for LC
 * @route POST /api/trade-finance/lcs/:id/documents
 * @param {string} id - LC ID
 * @param {file} file - Document file
 * @returns {Object} Uploaded document object
 */
router.post('/:id/documents', requireAuth, requireAny('trade-finance'),
  letterOfCreditController.uploadDocument
);

/**
 * Cancel LC
 * @route POST /api/trade-finance/lcs/:id/cancel
 * @param {string} id - LC ID
 * @returns {Object} Updated LC object
 */
router.post('/:id/cancel', requireAuth, requireAny('trade-finance'),
  body('reason').notEmpty(),
  handleValidationErrors,
  letterOfCreditController.cancel
);

module.exports = router;
