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
const { brandScope } = require('../middleware/brandScope');
const { body, handleValidationErrors } = require('../middleware/validation');
const { validate, productSchemas } = require('../middleware/zodValidation');

// Phase 4, C14: brand-scope every product request. Single-brand users see
// only their brand's catalog; super-admin in cross-brand mode sees all.
router.use(requireAuth, brandScope);

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
// Phase 4.5 C21 follow-up — archive/restore (admin/manager only, audited).
router.patch('/categories/:id/archive', requireAuth, requireRole('admin', 'manager'), categoryController.archiveCategory);
router.patch('/categories/:id/restore', requireAuth, requireRole('admin', 'manager'), categoryController.restoreCategory);

// Legacy flat-list route — kept for backwards compatibility
router.get('/categories', requireAuth, categoryController.getCategoriesFlat);

router.get('/search', requireAuth, productController.search);

router.get('/:id', requireAuth, productController.getById);

router.put('/:id', requireAuth, requireAny('products'),
  handleValidationErrors,
  productController.update
);

router.get('/:id/price-history', requireAuth, productController.getPriceHistory);
// Phase 4.9.5: canonical current-price read endpoint. Wraps
// services/productPriceService.getCurrentPrice. Query params:
//   origin (optional) — defaults to the product's originCountry
//   asOfDate (optional, YYYY-MM-DD) — defaults to today
router.get('/:id/current-price', requireAuth, productController.getCurrentPriceEndpoint);
router.post('/:id/prices', requireAuth, requireAny('products'), productController.createPrice);
router.put('/:id/prices/:priceId', requireAuth, requireAny('products'), productController.updatePrice);
router.delete('/:id/prices/:priceId', requireAuth, requireAny('products'), productController.deletePrice);

router.get('/category/:categoryId', requireAuth, productController.getByCategory);

router.post('/bulk-update', requireAuth, requireAny('products'),
  body('products').isArray(),
  handleValidationErrors,
  productController.bulkUpdate
);

router.delete('/:id', requireAuth, requireAny('products'),
  productController.softDelete
);

// Phase 4.17 — Product approval workflow. Super-admin-only because
// approving a Product flips it live (quotable + visible in catalog
// filters) and rejecting soft-deletes it. The matching ScheduledActivity
// state-machine updates happen inside the controller.
router.post('/:id/approve', requireAuth, requireRole('super_admin', 'admin'),
  productController.approve
);
router.post('/:id/reject', requireAuth, requireRole('super_admin', 'admin'),
  productController.reject
);
router.post('/:id/request-revision', requireAuth, requireRole('super_admin', 'admin'),
  productController.requestRevision
);

// Phase 4.21b — Odoo-style related data for the ProductDetail page.
// All four endpoints are brand-scoped on the parent (Quotation / SalesOrder /
// PurchaseOrder / Inquiry). The Item join tables don't carry brandCode so the
// scope lives on the include where.
router.get('/:id/quotations',      requireAuth, productController.getRelatedQuotations);
router.get('/:id/sales-orders',    requireAuth, productController.getRelatedSalesOrders);
router.get('/:id/purchase-orders', requireAuth, productController.getRelatedPurchaseOrders);
router.get('/:id/inquiries',       requireAuth, productController.getRelatedInquiries);

module.exports = router;
