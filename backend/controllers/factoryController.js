const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

const create = async (req, res, next) => {
  try {
    const { companyName, contactPerson, email, phone, address, city, country, currency, paymentTerms, leadTimeDays, certifications, specializations } = req.body;

    const factory = await db.Factory.create({
      id: uuidv4(),
      companyName,
      contactPerson,
      email,
      phone,
      address,
      city,
      country,
      currency: currency || 'USD',
      paymentTerms: paymentTerms || 'Net 60',
      leadTimeDays: leadTimeDays || 30,
      certifications: certifications || [],
      specializations: specializations || [],
      rating: 5,
      isActive: true
    });

    res.status(201).json(getSuccessResponse(factory, 'Factory created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Factory', factory.id, { data: factory.toJSON() }, req.ip).catch(() => {});
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

    const { count, rows } = await db.Factory.findAndCountAll({
      where,
      include: [{ model: db.Product, as: 'products', attributes: ['id', 'name', 'sku'] }],
      offset,
      limit: parseInt(limit),
      order: [['companyName', 'ASC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
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

    res.json(getSuccessResponse(factory));
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyName, contactPerson, email, phone, address, city, country, currency, paymentTerms, leadTimeDays, certifications, specializations, rating, isActive } = req.body;

    const factory = await db.Factory.findByPk(id);
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }

    const beforeSnapshot = factory.toJSON();

    await factory.update({
      companyName: companyName || factory.companyName,
      contactPerson: contactPerson !== undefined ? contactPerson : factory.contactPerson,
      email: email || factory.email,
      phone: phone || factory.phone,
      address: address !== undefined ? address : factory.address,
      city: city !== undefined ? city : factory.city,
      country: country !== undefined ? country : factory.country,
      currency: currency || factory.currency,
      paymentTerms: paymentTerms || factory.paymentTerms,
      leadTimeDays: leadTimeDays !== undefined ? leadTimeDays : factory.leadTimeDays,
      certifications: certifications || factory.certifications,
      specializations: specializations || factory.specializations,
      rating: rating !== undefined ? rating : factory.rating,
      isActive: isActive !== undefined ? isActive : factory.isActive
    });

    res.json(getSuccessResponse(factory, 'Factory updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Factory', id, { before: beforeSnapshot, after: factory.toJSON() }, req.ip).catch(() => {});
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

    const { count, rows } = await db.Product.findAndCountAll({
      where: { factoryId: id },
      include: [
        { model: db.ProductCategory, as: 'category' },
        { model: db.ProductPrice, as: 'prices' }
      ],
      offset,
      limit: parseInt(limit),
      order: [['name', 'ASC']]
    });

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

      await db.ProductPrice.create({
        id: uuidv4(),
        productId: priceUpdate.productId,
        factoryId: id,
        costPrice: priceUpdate.costPrice,
        markup: priceUpdate.markup || 20,
        sellingPrice: priceUpdate.sellingPrice,
        currency: priceUpdate.currency || factory.currency,
        isActive: true,
        validFrom: new Date()
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

module.exports = {
  create,
  getAll,
  getById,
  update,
  getProducts,
  updatePrices,
  getPerformance
};
