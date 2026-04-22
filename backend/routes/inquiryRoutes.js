/**
 * Inquiry Management Routes
 * @module routes/inquiryRoutes
 * @description Endpoints for managing customer inquiries and request-for-quote process
 * @requires express
 * @requires ../controllers/inquiryController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 * @requires ../middleware/zodValidation
 */

const express = require('express');
const router = express.Router();
const inquiryController = require('../controllers/inquiryController');
const { requireAuth, requireAny } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');
const { validate, inquirySchemas } = require('../middleware/zodValidation');

/**
 * Create a new inquiry
 * @route POST /api/inquiries
 * @param {string} customerId - Customer ID
 * @param {Array} items - Array of inquiry items
 * @returns {Object} Created inquiry object
 */
router.post('/', requireAuth, requireAny('inquiries'),
  body('customerId').notEmpty(),
  body('items').isArray(),
  handleValidationErrors,
  validate(inquirySchemas.create),
  inquiryController.create
);

router.get('/', requireAuth, inquiryController.getAll);

router.get('/:id', requireAuth, inquiryController.getById);

router.patch('/:id/status', requireAuth, requireAny('inquiries'),
  body('status').notEmpty(),
  handleValidationErrors,
  validate(inquirySchemas.updateStatus),
  inquiryController.updateStatus
);

router.post('/:id/follow-up', requireAuth, requireAny('inquiries'),
  body('followUpDate').notEmpty(),
  handleValidationErrors,
  inquiryController.followUp
);

router.post('/:id/convert-to-quotation', requireAuth, requireAny('inquiries'),
  body('items').isArray(),
  handleValidationErrors,
  inquiryController.convertToQuotation
);

router.get('/:id/timeline', requireAuth, inquiryController.getTimeline);

module.exports = router;
