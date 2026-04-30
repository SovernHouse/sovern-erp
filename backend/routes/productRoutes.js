/**
 * Product Management Routes
 * @module routes/productRoutes
 * @description Endpoints for managing products including pricing and inventory
 * @requires express
 * @requires ../controllers/productController
 * @requires ../middleware/auth
 * @requires ../middleware/validation
 * @requires ../middleware/zodValidation
 */

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const categoryController = require('../controllers/productCategoryController');
const { requireAuth, requireAny, requireRole } = require('../middleware/auth');
const { body, handleValidationErrors } = require('../middleware/validation');
const { validate, productSchemas } = require('../middleware/zodValidation');

/**
 * Create a new product
 * @route POST /api/products
 * @param {string} name - Product name
 * @param {string} sku - Product SKU
 * @param {string} categoryId - Product category ID
 * @param {string} factoryId - Factory ID
 * @returns {Object} Created product object
 */
router.post('/', requireAuth, requireAny('products'),
  body('name').notEmpty(),
  body('sku').notEmpty(),
  body('categoryId').notEmpty(),
  body('factoryId').notEmpty(),
  handleValidationErrors,
  validate(productSchemas.create),
  productController.create
);

router.get('/', requireAuth, productController.getAll);

// ── Category management routes ────────────────────────────────────────────────
router.get('/categories/tree', requireAuth, categoryController.getCategoryTree);
router.get('/categories/flat', requireAuth, categoryController.getCategoriesFlat);
router.get('/categories/export', requireAuth, requireRole('admin', 'manager'), categoryController.exportCategories);
router.post('/categories/import', requireAuth, requireRole('admin'), categoryController.importCategories);
router.post('/categories/seed', requireAuth, requireRole('admin'), categoryController.seedDefaultTemplate);
router.get('/categories/templates', requireAuth, categoryController.getTemplates);
router.post('/categories/templates', requireAuth, requireRole('admin'), categoryController.saveAsTemplate);
router.post('/categories/templates/:id/load', requireAuth, requireRole('admin'), categoryController.loadTemplate);
router.delete('/categories/templates/:id', requireAuth, requireRole('admin'), categoryController.deleteTemplate);
router.post('/categories', requireAuth, requireRole('admin', 'manager'), categoryController.createCategory);
router.put('/categories/:id', requireAuth, requireRole('admin', 'manager'), categoryController.updateCategory);
router.delete('/categories/:id', requireAuth, requireRole('admin'), categoryController.deleteCategory);

// Legacy flat-list route — kept for backwards compatibility
router.get('/categories', requireAuth, categoryController.getCategoriesFlat);

router.get('/search', requireAuth, productController.search);

router.get('/:id', requireAuth, productController.getById);

router.put('/:id', requireAuth, requireAny('products'),
  handleValidationErrors,
  productController.update
);

router.get('/:id/price-history', requireAuth, productController.getPriceHistory);

router.get('/category/:categoryId', requireAuth, productController.getByCategory);

router.post('/bulk-update', requireAuth, requireAny('products'),
  body('products').isArray(),
  handleValidationErrors,
  productController.bulkUpdate
);

router.delete('/:id', requireAuth, requireAny('products'),
  productController.softDelete
);

module.exports = router;
