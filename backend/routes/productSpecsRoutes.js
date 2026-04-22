/**
 * Product Specifications Routes
 * @module routes/productSpecsRoutes
 * @description Endpoints for managing flooring product specifications
 * @requires express
 * @requires ../controllers/productSpecsController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 */

const express = require('express');
const router = express.Router();
const productSpecsController = require('../controllers/productSpecsController');
const { requireAuth, requireAny } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');

// ── Per-Product Specs ──

router.get('/:id/specs', requireAuth, productSpecsController.getSpecs);

router.post('/:id/specs', requireAuth, requireAny('products'),
  productSpecsController.createSpecs
);

router.put('/:id/specs', requireAuth, requireAny('products'),
  productSpecsController.updateSpecs
);

// ── Filtering & Comparison ──

router.get('/specs/filter', requireAuth, productSpecsController.filterBySpecs);

router.post('/specs/compare', requireAuth,
  body('productIds').isArray(),
  handleValidationErrors,
  productSpecsController.compareSpecs
);

// ── Blank Template ──

router.get('/specs/template', requireAuth, productSpecsController.getTemplate);

// ── Spec Templates CRUD ──

router.get('/templates', requireAuth, productSpecsController.getSpecTemplates);

router.get('/templates/:id', requireAuth, productSpecsController.getSpecTemplate);

router.post('/templates', requireAuth, requireAny('products'),
  body('name').notEmpty().withMessage('Template name is required'),
  handleValidationErrors,
  productSpecsController.createSpecTemplate
);

router.put('/templates/:id', requireAuth, requireAny('products'),
  productSpecsController.updateSpecTemplate
);

router.delete('/templates/:id', requireAuth, requireAny('products'),
  productSpecsController.deleteSpecTemplate
);

router.post('/templates/:id/apply', requireAuth, requireAny('products'),
  body('productId').notEmpty().withMessage('Product ID is required'),
  handleValidationErrors,
  productSpecsController.applySpecTemplate
);

module.exports = router;
