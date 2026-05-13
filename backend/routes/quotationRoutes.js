/**
 * Quotation Management Routes
 * @module routes/quotationRoutes
 * @description Endpoints for managing quotations including creation, status updates, and PDF generation
 * @requires express
 * @requires ../controllers/quotationController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 * @requires ../middleware/zodValidation
 */

const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { requireAuth, requireAny } = require('../middleware/auth');
const { brandScope } = require('../middleware/brandScope');
const { body, handleValidationErrors } = require('../middleware/validation');
const { validate, quotationSchemas } = require('../middleware/zodValidation');

// Phase 1 Commit 3b-B: brand-scope every quotation request.
router.use(requireAuth, brandScope);

/**
 * Create a new quotation
 * @route POST /api/quotations
 * @param {string} customerId - Customer ID
 * @param {Array} items - Array of quoted items
 * @returns {Object} Created quotation object
 */
router.post('/', requireAuth, requireAny('quotations'),
  body('customerId').notEmpty(),
  body('items').isArray(),
  handleValidationErrors,
  validate(quotationSchemas.create),
  quotationController.create
);

router.get('/', requireAuth, quotationController.getAll);

router.get('/:id', requireAuth, quotationController.getById);

router.put('/:id', requireAuth, requireAny('quotations'),
  handleValidationErrors,
  quotationController.update
);

router.post('/:id/send', requireAuth, requireAny('quotations:generate'),
  quotationController.send
);

router.patch('/:id/accept', requireAuth,
  quotationController.accept
);

router.patch('/:id/reject', requireAuth,
  quotationController.reject
);

router.post('/:id/duplicate', requireAuth, requireAny('quotations'),
  quotationController.duplicate
);

router.post('/:id/convert-to-pi', requireAuth, requireAny('quotations'),
  handleValidationErrors,
  quotationController.convertToProformaInvoice
);

router.get('/:id/pdf', requireAuth, quotationController.generatePDF);

router.delete('/:id', requireAuth, requireAny('quotations'),
  quotationController.softDelete
);

module.exports = router;
