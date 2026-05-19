const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const factoryWriteService = require('../services/aiWriteServices/factoryWriteService');

const canViewFactory = (user, factory) => {
  if (!factory.isConfidential) return true;
  const allowed = Array.isArray(factory.allowedUserIds) ? factory.allowedUserIds : [];
  return allowed.includes(user.id);
};

const create = async (req, res, next) => {
  try {
    const result = await factoryWriteService.createFactory(req.body || {}, {
      userId: req.user?.id || null,
      ip: req.ip || null,
      source: 'rest',
    });
    if (!result.ok) {
      return res.status(result.httpStatus || 400).json({ success: false, message: result.message });
    }
    res.status(201).json(getSuccessResponse(result.factory, 'Factory created successfully'));
    auditService.logAction(req.user?.id, 'CREATE', 'Factory', result.factory.id,
      { data: result.factory.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (status) where.isActive = status === 'active';
    if (search) {
      where[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    // PERF: split count from data fetch.
    const [count, rows] = await Promise.all([
      db.Factory.count({ where }),
      db.Factory.findAll({
        where,
        include: [{ model: db.Product, as: 'products', attributes: ['id', 'name', 'sku'] }],
        offset,
        limit: parseInt(limit),
        order: [['companyName', 'ASC']]
      }),
    ]);

    // Filter out confidential factories the requesting user is not permitted to see
    const visibleRows = rows.filter(f => canViewFactory(req.user, f));
    const visibleCount = count - (rows.length - visibleRows.length);

    res.json(getPaginatedResponse(visibleRows, visibleCount, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factory = await db.Factory.findByPk(id, {
      include: [
        { model: db.Product, as: 'products', attributes: ['id', 'name', 'sku'] },
        { model: db.ProductPrice, as: 'productPrices', limit: 10 }
      ]
    });

    if (!factory) {
      throw new NotFoundError('Factory not found');
    }

    if (!canViewFactory(req.user, factory)) {
      throw new NotFoundError('Factory not found');
    }

    res.json(getSuccessResponse(factory));
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await factoryWriteService.updateFactory(id, req.body || {}, {
      userId: req.user?.id || null,
      ip: req.ip || null,
      source: 'rest',
    });
    if (!result.ok) {
      if (result.code === 'not_found') return next(new NotFoundError(result.message));
      return res.status(result.httpStatus || 400).json({ success: false, message: result.message });
    }
    res.json(getSuccessResponse(result.factory, 'Factory updated successfully'));
    auditService.logAction(req.user?.id, 'UPDATE', 'Factory', id,
      { before: result.before, after: result.after }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    const factory = await db.Factory.findByPk(id);
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }

    // PERF: split count from data fetch.
    const [count, rows] = await Promise.all([
      db.Product.count({ where: { factoryId: id } }),
      db.Product.findAll({
        where: { factoryId: id },
        include: [
          { model: db.ProductCategory, as: 'category' },
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

// Phase 4.28t (2026-05-19): related-data endpoint matching the Odoo
// detail-page pattern. The admin FactoryDetail.jsx already calls this
// in its Promise.all batch; before this commit it 404'd and bounced
// the whole page back to the factories list. Brand-scope honoured via
// req.brandScope.where when present.
const getPurchaseOrders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const { offset } = getPagination(page, limit);

    const factory = await db.Factory.findByPk(id);
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }

    const where = { ...(req.brandScope?.where || {}), factoryId: id };
    const [count, rows] = await Promise.all([
      db.PurchaseOrder.count({ where }),
      db.PurchaseOrder.findAll({
        where,
        include: [
          { model: db.SalesOrder, as: 'salesOrder', attributes: ['id', 'orderNumber'] },
        ],
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']],
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

const updatePrices = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { prices } = req.body;

    const factory = await db.Factory.findByPk(id);
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }

    for (const priceUpdate of prices) {
      const existingPrice = await db.ProductPrice.findOne({
        where: {
          productId: priceUpdate.productId,
          factoryId: id,
          isActive: true
        }
      });

      if (existingPrice) {
        await existingPrice.update({ isActive: false });
      }

      // Phase 4.19 emergency: this entire factory price-update payload
      // was hitting the pre-4.9.2b ProductPrice schema. Sequelize silently
      // drops unknown attributes (L-051), so every factory-prices update
      // since the rename has been a no-op. Fixed by translating the
      // controller's input shape (costPrice/markup/sellingPrice/isActive)
      // to the post-rename column set:
      //   costPrice    → costPriceUsdPerM2
      //   markup       → markupPercent (decimal 0..1; convert if percent)
      //   sellingPrice → sellingPriceUsdPerM2 (compute if absent)
      //   isActive=true → not a column; controlled by validFrom/validTo
      const costPrice = priceUpdate.costPrice;
      const rawMarkup = priceUpdate.markup;
      const markupPercent = rawMarkup != null
        ? (Number(rawMarkup) > 1 ? Number(rawMarkup) / 100 : Number(rawMarkup))
        : 0.20;
      const sellingPrice = priceUpdate.sellingPrice != null
        ? Number(priceUpdate.sellingPrice)
        : (costPrice != null ? +(Number(costPrice) * (1 + markupPercent)).toFixed(4) : null);
      await db.ProductPrice.create({
        id: uuidv4(),
        productId: priceUpdate.productId,
        factoryId: id,
        costPriceUsdPerM2:   costPrice,
        markupPercent:       markupPercent,
        sellingPriceUsdPerM2: sellingPrice,
        currency:            priceUpdate.currency || factory.currency,
        validFrom:           new Date(),
      });
    }

    res.json(getSuccessResponse(null, 'Prices updated successfully'));
  } catch (error) {
    next(error);
  }
};

const getPerformance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { period = 'month' } = req.query;

    const factory = await db.Factory.findByPk(id);
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }

    const dateThreshold = new Date();
    switch (period) {
      case 'week':
        dateThreshold.setDate(dateThreshold.getDate() - 7);
        break;
      case 'month':
        dateThreshold.setMonth(dateThreshold.getMonth() - 1);
        break;
      case 'year':
        dateThreshold.setFullYear(dateThreshold.getFullYear() - 1);
        break;
    }

    const totalPOs = await db.PurchaseOrder.count({
      where: { factoryId: id, createdAt: { [Op.gte]: dateThreshold } }
    });

    const completedPOs = await db.PurchaseOrder.count({
      where: { factoryId: id, status: 'completed', createdAt: { [Op.gte]: dateThreshold } }
    });

    const totalValue = await db.PurchaseOrder.sum('total', {
      where: { factoryId: id, createdAt: { [Op.gte]: dateThreshold } }
    });

    const inspections = await db.Inspection.count({
      where: { factoryId: id, createdAt: { [Op.gte]: dateThreshold } }
    });

    const passedInspections = await db.Inspection.count({
      where: { factoryId: id, overallResult: 'pass', createdAt: { [Op.gte]: dateThreshold } }
    });

    const onTimeDeliveries = await db.PurchaseOrder.count({
      where: {
        factoryId: id,
        status: 'completed',
        [Op.and]: [
          db.sequelize.where(
            db.sequelize.col('actualArrival'),
            Op.lte,
            db.sequelize.col('expectedDelivery')
          )
        ]
      }
    });

    res.json(getSuccessResponse({
      factory,
      performance: {
        totalPOs,
        completedPOs,
        completionRate: totalPOs ? ((completedPOs / totalPOs) * 100).toFixed(2) : 0,
        totalValue: totalValue || 0,
        inspections,
        passedInspections,
        inspectionPassRate: inspections ? ((passedInspections / inspections) * 100).toFixed(2) : 0,
        onTimeDeliveries,
        onTimeRate: completedPOs ? ((onTimeDeliveries / completedPOs) * 100).toFixed(2) : 0
      }
    }));
  } catch (error) {
    next(error);
  }
};

const delete_ = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await factoryWriteService.deleteFactory(id, {
      userId: req.user?.id || null,
      ip: req.ip || null,
      source: 'rest',
    });
    if (!result.ok) {
      if (result.code === 'not_found') return next(new NotFoundError(result.message));
      if (result.code === 'validation') return next(new ValidationError(result.message));
      return res.status(result.httpStatus || 400).json({ success: false, message: result.message });
    }
    res.json(getSuccessResponse(null, 'Factory deleted successfully'));
    auditService.logAction(req.user?.id, 'DELETE', 'Factory', id,
      { before: result.deleted }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
  getById,
  update,
  delete: delete_,
  getProducts,
  getPurchaseOrders,
  updatePrices,
  getPerformance
};
