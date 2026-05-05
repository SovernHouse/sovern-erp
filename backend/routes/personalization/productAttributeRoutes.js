const express = require('express');
const router = express.Router();
const db = require('../../models');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { getSuccessResponse } = require('../../utils/helpers');

router.get('/product-attributes', requireAuth, async (req, res, next) => {
  try {
    const { categoryId, isActive } = req.query;
    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const attributes = await db.ProductAttribute.findAll({
      where,
      include: [{ model: db.ProductCategory, attributes: ['id', 'name'] }],
      order: [['sequence', 'ASC'], ['createdAt', 'ASC']]
    });

    res.json(getSuccessResponse(attributes));
  } catch (error) {
    next(error);
  }
});

/**
 * Create a product attribute
 * @route POST /api/personalization/product-attributes
 */
router.post('/product-attributes', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const attr = await db.ProductAttribute.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json(getSuccessResponse({ message: 'Product attribute created', data: attr }));
  } catch (error) {
    next(error);
  }
});

/**
 * Update a product attribute
 * @route PUT /api/personalization/product-attributes/:id
 */
router.put('/product-attributes/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const attr = await db.ProductAttribute.findByPk(req.params.id);
    if (!attr) return res.status(404).json({ success: false, error: { message: 'Attribute not found', statusCode: 404 } });
    await attr.update(req.body);
    res.json(getSuccessResponse({ message: 'Attribute updated', data: attr }));
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a product attribute
 * @route DELETE /api/personalization/product-attributes/:id
 */
router.delete('/product-attributes/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const attr = await db.ProductAttribute.findByPk(req.params.id);
    if (!attr) return res.status(404).json({ success: false, error: { message: 'Attribute not found', statusCode: 404 } });
    await attr.destroy();
    res.json(getSuccessResponse({ message: 'Attribute deleted' }));
  } catch (error) {
    next(error);
  }
});

/**
 * Reorder product attributes
 * @route PUT /api/personalization/product-attributes/reorder
 */
router.put('/product-attributes/reorder', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ success: false, error: { message: 'orderedIds must be an array', statusCode: 400 } });

    for (let i = 0; i < orderedIds.length; i++) {
      await db.ProductAttribute.update({ sequence: i }, { where: { id: orderedIds[i] } });
    }

    res.json(getSuccessResponse({ message: 'Attributes reordered' }));
  } catch (error) {
    next(error);
  }
});

// ========================================================================

module.exports = router;
