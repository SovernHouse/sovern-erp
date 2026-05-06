const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

const create = async (req, res, next) => {
  try {
    const { name, sku, description, categoryId, factoryId, unit, specifications, images, minOrderQty, weight, hsCode } = req.body;

    const existingSku = await db.Product.findOne({ where: { sku } });
    if (existingSku) {
      throw new ValidationError('SKU already exists');
    }

    const category = await db.ProductCategory.findByPk(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const factory = await db.Factory.findByPk(factoryId);
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }

    const product = await db.Product.create({
      id: uuidv4(),
      name,
      sku,
      description,
      categoryId,
      factoryId,
      unit: unit || 'sqm',
      specifications: specifications || {},
      images: images || [],
      minOrderQty: minOrderQty || 1,
      weight,
      hsCode,
      isActive: true
    });

    const result = await db.Product.findByPk(product.id, {
      include: [
        { model: db.ProductCategory, as: 'category' },
        { model: db.Factory, as: 'factory' },
        { model: db.ProductPrice, as: 'prices' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Product created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Product', product.id, { data: result?.toJSON?.() || product.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, categoryId, factoryId, status } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { deletedAt: null };
    if (status) where.isActive = status === 'active';
    if (categoryId) where.categoryId = categoryId;
    if (factoryId) where.factoryId = factoryId;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } }
      ];
    }

    // PERF: split count from data fetch.
    const [count, rows] = await Promise.all([
      db.Product.count({ where }),
      db.Product.findAll({
        where,
        include: [
          { model: db.ProductCategory, as: 'category' },
          { model: db.Factory, as: 'factory' },
          { model: db.ProductPrice, as: 'prices', attributes: ['sellingPrice', 'currency'] }
        ],
        offset,
        limit: parseInt(limit),
        order: [['name', 'ASC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await db.Product.findByPk(id, {
      include: [
        { model: db.ProductCategory, as: 'category' },
        { model: db.Factory, as: 'factory' },
        { model: db.ProductPrice, as: 'prices' }
      ]
    });

    if (!product || product.deletedAt) {
      throw new NotFoundError('Product not found');
    }

    res.json(getSuccessResponse(product));
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, salesDescription, purchaseDescription, unit, specifications, images, minOrderQty, weight, hsCode, isActive } = req.body;

    const product = await db.Product.findByPk(id);
    if (!product || product.deletedAt) {
      throw new NotFoundError('Product not found');
    }

    const beforeSnapshot = product.toJSON();

    await product.update({
      name: name || product.name,
      description: description !== undefined ? description : product.description,
      salesDescription: salesDescription !== undefined ? salesDescription : product.salesDescription,
      purchaseDescription: purchaseDescription !== undefined ? purchaseDescription : product.purchaseDescription,
      unit: unit || product.unit,
      specifications: specifications || product.specifications,
      images: images || product.images,
      minOrderQty: minOrderQty !== undefined ? minOrderQty : product.minOrderQty,
      weight: weight !== undefined ? weight : product.weight,
      hsCode: hsCode !== undefined ? hsCode : product.hsCode,
      isActive: isActive !== undefined ? isActive : product.isActive
    });

    const result = await db.Product.findByPk(id, {
      include: [
        { model: db.ProductCategory, as: 'category' },
        { model: db.Factory, as: 'factory' }
      ]
    });

    res.json(getSuccessResponse(result, 'Product updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Product', id, { before: beforeSnapshot, after: result?.toJSON?.() || product.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    const category = await db.ProductCategory.findByPk(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // PERF: split count from data fetch.
    const [count, rows] = await Promise.all([
      db.Product.count({ where: { categoryId, deletedAt: null } }),
      db.Product.findAll({
        where: { categoryId, deletedAt: null },
        include: [
          { model: db.Factory, as: 'factory' },
          { model: db.ProductPrice, as: 'prices' }
        ],
        offset,
        limit: parseInt(limit),
        order: [['name', 'ASC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

const createPrice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { factoryId, costPrice, exwPrice, priceType, markup, sellingPrice, currency, validFrom, validTo } = req.body;

    const product = await db.Product.findByPk(id);
    if (!product || product.deletedAt) throw new NotFoundError('Product not found');

    const factory = await db.Factory.findByPk(factoryId);
    if (!factory) throw new NotFoundError('Factory not found');

    if (!costPrice || isNaN(parseFloat(costPrice))) throw new ValidationError('costPrice is required');

    const markupPct = parseFloat(markup) || 20;
    // Sovern margin formula: sell = cost / (1 - margin%)
    const computedSell = sellingPrice || parseFloat(costPrice) / (1 - markupPct / 100);

    // Deactivate any existing active price for this factory on this product
    await db.ProductPrice.update(
      { isActive: false },
      { where: { productId: id, factoryId, isActive: true } }
    );

    const price = await db.ProductPrice.create({
      id: uuidv4(),
      productId: id,
      factoryId,
      costPrice: parseFloat(costPrice),
      exwPrice: exwPrice ? parseFloat(exwPrice) : null,
      priceType: priceType || 'FOB',
      markup: markupPct,
      sellingPrice: parseFloat(computedSell.toFixed(2)),
      currency: currency || 'USD',
      validFrom: validFrom || new Date(),
      validTo: validTo || null,
      isActive: true
    });

    const result = await db.ProductPrice.findByPk(price.id, {
      include: [{ model: db.Factory, as: 'factory', attributes: ['id', 'companyName'] }]
    });

    res.status(201).json(getSuccessResponse(result, 'Price added successfully'));
    auditService.logAction(req.user.id, 'CREATE', 'ProductPrice', price.id, { productId: id }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const updatePrice = async (req, res, next) => {
  try {
    const { id, priceId } = req.params;
    const { costPrice, exwPrice, priceType, markup, sellingPrice, currency, validTo, isActive } = req.body;

    const price = await db.ProductPrice.findOne({ where: { id: priceId, productId: id } });
    if (!price) throw new NotFoundError('Price record not found');

    const newCost = costPrice !== undefined ? parseFloat(costPrice) : price.costPrice;
    const newMarkup = markup !== undefined ? parseFloat(markup) : price.markup;
    // Recalculate sell price if cost or markup changed and sellingPrice not explicitly provided
    const newSell = sellingPrice !== undefined
      ? parseFloat(sellingPrice)
      : parseFloat(newCost) / (1 - newMarkup / 100);

    await price.update({
      costPrice: newCost,
      exwPrice: exwPrice !== undefined ? (exwPrice ? parseFloat(exwPrice) : null) : price.exwPrice,
      priceType: priceType || price.priceType,
      markup: newMarkup,
      sellingPrice: parseFloat(newSell.toFixed(2)),
      currency: currency || price.currency,
      validTo: validTo !== undefined ? validTo : price.validTo,
      isActive: isActive !== undefined ? isActive : price.isActive
    });

    const result = await db.ProductPrice.findByPk(priceId, {
      include: [{ model: db.Factory, as: 'factory', attributes: ['id', 'companyName'] }]
    });

    res.json(getSuccessResponse(result, 'Price updated successfully'));
    auditService.logAction(req.user.id, 'UPDATE', 'ProductPrice', priceId, { productId: id }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const deletePrice = async (req, res, next) => {
  try {
    const { id, priceId } = req.params;
    const price = await db.ProductPrice.findOne({ where: { id: priceId, productId: id } });
    if (!price) throw new NotFoundError('Price record not found');

    await price.destroy();
    res.json(getSuccessResponse({ id: priceId }, 'Price deleted successfully'));
    auditService.logAction(req.user.id, 'DELETE', 'ProductPrice', priceId, { productId: id }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getPriceHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await db.Product.findByPk(id);
    if (!product || product.deletedAt) {
      throw new NotFoundError('Product not found');
    }

    const prices = await db.ProductPrice.findAll({
      where: { productId: id },
      include: [{ model: db.Factory, as: 'factory', attributes: ['companyName'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(prices));
  } catch (error) {
    next(error);
  }
};

const search = async (req, res, next) => {
  try {
    const { q, categoryId, factoryId } = req.query;

    const where = { deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    if (factoryId) where.factoryId = factoryId;
    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { sku: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } }
      ];
    }

    const products = await db.Product.findAll({
      where,
      include: [
        { model: db.ProductPrice, as: 'prices', limit: 1, separate: true }
      ],
      limit: 20
    });

    res.json(getSuccessResponse(products));
  } catch (error) {
    next(error);
  }
};

const bulkUpdate = async (req, res, next) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      throw new ValidationError('Products array is required and must not be empty');
    }

    const updates = [];
    for (const product of products) {
      if (!product.id) {
        throw new ValidationError('Each product must have an id');
      }

      // Verify product exists and is not deleted
      const existingProduct = await db.Product.findByPk(product.id);
      if (!existingProduct || existingProduct.deletedAt) {
        throw new NotFoundError(`Product ${product.id} not found`);
      }

      const updated = await db.Product.update(product, { where: { id: product.id } });
      updates.push({
        id: product.id,
        status: 'updated'
      });
    }

    res.json(getSuccessResponse(updates, `${products.length} products updated successfully`));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'BULK_UPDATE', 'Product', 'batch', { count: products.length, productIds: products.map(p => p.id) }, null).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const softDelete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await db.Product.findByPk(id);

    if (!product || product.deletedAt) {
      throw new NotFoundError('Product not found');
    }

    const beforeSnapshot = product.toJSON();

    await product.update({ deletedAt: new Date() });

    res.json(getSuccessResponse({ id: product.id }, 'Product deleted'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Product', id, { before: beforeSnapshot }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
  getById,
  update,
  getByCategory,
  createPrice,
  updatePrice,
  deletePrice,
  getPriceHistory,
  search,
  bulkUpdate,
  softDelete
};
