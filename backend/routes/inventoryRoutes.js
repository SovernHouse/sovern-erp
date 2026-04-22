const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

// GET / - List all inventory with pagination, search, filters
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, lowStock, factoryId } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { isActive: true };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } }
      ];
    }

    if (lowStock === 'true') {
      where[Op.and] = db.sequelize.where(
        db.sequelize.col('stock_quantity'),
        Op.lte,
        db.sequelize.col('reorder_point')
      );
    }

    if (factoryId) {
      where.factoryId = factoryId;
    }

    const { count, rows } = await db.Product.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      include: [
        { model: db.Factory, as: 'factory', attributes: ['id', 'companyName'] }
      ],
      order: [['name', 'ASC']]
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
});

// GET /low-stock - Get items below reorder point
router.get('/low-stock', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    const products = await db.Product.findAndCountAll({
      where: {
        isActive: true,
        [Op.and]: db.sequelize.where(
          db.sequelize.col('stock_quantity'),
          Op.lte,
          db.sequelize.col('reorder_point')
        )
      },
      offset,
      limit: parseInt(limit),
      include: [
        { model: db.Factory, as: 'factory', attributes: ['id', 'companyName'] }
      ],
      order: [['stock_quantity', 'ASC']]
    });

    res.json(getPaginatedResponse(products.rows, products.count, page, limit));
  } catch (error) {
    next(error);
  }
});

// GET /:id - Get single inventory item (this must come after other specific routes)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const product = await db.Product.findByPk(req.params.id, {
      include: [
        { model: db.Factory, as: 'factory' },
        { model: db.ProductCategory, as: 'category' }
      ]
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    res.json(getSuccessResponse(product, 'Product retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// POST /:id/adjust - Adjust stock (add/remove with reason)
router.post('/:id/adjust', requireAuth, requireRole('admin', 'operations'), async (req, res, next) => {
  try {
    const { quantity, reason, notes } = req.body;

    if (!quantity || typeof quantity !== 'number') {
      throw new ValidationError('Valid quantity is required');
    }

    if (!reason) {
      throw new ValidationError('Reason for adjustment is required');
    }

    const product = await db.Product.findByPk(req.params.id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const previousQuantity = product.stockQuantity || 0;
    const newQuantity = Math.max(0, previousQuantity + quantity);

    // Update product stock
    await product.update({
      stockQuantity: newQuantity
    });

    // Log the transaction
    if (db.InventoryTransaction) {
      await db.InventoryTransaction.create({
        productId: product.id,
        quantity,
        reason,
        notes,
        previousQuantity,
        newQuantity,
        userId: req.user.id,
        type: quantity > 0 ? 'ADD' : 'REMOVE'
      });
    }

    const updated = await db.Product.findByPk(product.id, {
      include: [
        { model: db.Factory, as: 'factory' }
      ]
    });

    res.json(getSuccessResponse(updated, 'Stock adjusted successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'ADJUST_STOCK',
      'Product',
      product.id,
      {
        previousQuantity,
        newQuantity,
        adjustmentQuantity: quantity,
        reason,
        notes
      },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
