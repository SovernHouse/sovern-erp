const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const { generateNumberWithCounter, incrementCounter } = require('../services/numberGenerator');

/**
 * Calculate landed cost for a product
 * FOB + Freight + Insurance + Customs Duty + Other Charges = Landed Cost
 */
const calculate = async (req, res, next) => {
  try {
    const {
      productId,
      supplierId,
      quantity,
      productCost,
      freight = 0,
      insurance = 0,
      customsDuty = 0,
      handlingCharges = 0,
      localDelivery = 0,
      currency = 'USD',
      exchangeRate = 1,
      purchaseOrderId = null,
      notes = null
    } = req.body;

    // Validate product and supplier
    const product = await db.Product.findByPk(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const supplier = await db.Factory.findByPk(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    // Generate reference number
    const lastCalc = await db.LandedCostCalculation.findOne({
      order: [['createdAt', 'DESC']]
    });
    const counter = incrementCounter(lastCalc?.referenceNumber);
    const referenceNumber = generateNumberWithCounter('LCC', counter);

    // Calculate landed cost components
    const totalProductCost = parseFloat(productCost) * parseFloat(quantity);
    const totalFreight = parseFloat(freight);
    const totalInsurance = parseFloat(insurance);
    const totalCustomsDuty = parseFloat(customsDuty);
    const totalHandling = parseFloat(handlingCharges);
    const totalLocalDelivery = parseFloat(localDelivery);

    const totalLandedCost = totalProductCost + totalFreight + totalInsurance + totalCustomsDuty + totalHandling + totalLocalDelivery;
    const costPerUnit = totalLandedCost / parseFloat(quantity);

    const calculation = await db.LandedCostCalculation.create({
      id: uuidv4(),
      referenceNumber,
      productId,
      supplierId,
      quantity: parseFloat(quantity),
      unit: product.unit || 'PCS',
      productCost: parseFloat(productCost),
      freight: totalFreight,
      insurance: totalInsurance,
      customsDuty: totalCustomsDuty,
      handlingCharges: totalHandling,
      localDelivery: totalLocalDelivery,
      totalLandedCost,
      costPerUnit,
      currency,
      exchangeRate: parseFloat(exchangeRate),
      purchaseOrderId: purchaseOrderId || null,
      templateId: null,
      notes
    });

    const result = await db.LandedCostCalculation.findByPk(calculation.id, {
      include: [
        { model: db.Product, as: 'product', attributes: ['id', 'name', 'sku'] },
        { model: db.Factory, as: 'supplier', attributes: ['id', 'name'] }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Landed cost calculated successfully'));

    auditService.logAction(req.user.id, 'CREATE', 'LandedCostCalculation', calculation.id, { data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get all landed cost calculations with filters
 */
const getCalculations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, productId, supplierId, purchaseOrderId, search } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (productId) where.productId = productId;
    if (supplierId) where.supplierId = supplierId;
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
    if (search) where.referenceNumber = { [Op.like]: `%${search}%` };

    const [count, rows] = await Promise.all([
      db.LandedCostCalculation.count({ where }),
      db.LandedCostCalculation.findAll({
        where,
        include: [
          { model: db.Product, as: 'product', attributes: ['id', 'name', 'sku'] },
          { model: db.Factory, as: 'supplier', attributes: ['id', 'name'] }
        ],
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

/**
 * Get specific calculation by ID
 */
const getCalculationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const calculation = await db.LandedCostCalculation.findByPk(id, {
      include: [
        { model: db.Product, as: 'product' },
        { model: db.Factory, as: 'supplier' },
        { model: db.LandedCostTemplate, as: 'template' }
      ]
    });

    if (!calculation) {
      throw new NotFoundError('Landed cost calculation not found');
    }

    res.json(getSuccessResponse(calculation));
  } catch (error) {
    next(error);
  }
};

/**
 * Update calculation details
 */
const updateCalculation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      quantity,
      productCost,
      freight,
      insurance,
      customsDuty,
      handlingCharges,
      localDelivery,
      exchangeRate,
      notes
    } = req.body;

    const calculation = await db.LandedCostCalculation.findByPk(id);
    if (!calculation) {
      throw new NotFoundError('Landed cost calculation not found');
    }

    const beforeSnapshot = calculation.toJSON();

    // Recalculate totals if any cost component changed
    const updatedQuantity = quantity !== undefined ? parseFloat(quantity) : calculation.quantity;
    const updatedProductCost = productCost !== undefined ? parseFloat(productCost) : calculation.productCost;
    const updatedFreight = freight !== undefined ? parseFloat(freight) : calculation.freight;
    const updatedInsurance = insurance !== undefined ? parseFloat(insurance) : calculation.insurance;
    const updatedCustomsDuty = customsDuty !== undefined ? parseFloat(customsDuty) : calculation.customsDuty;
    const updatedHandling = handlingCharges !== undefined ? parseFloat(handlingCharges) : calculation.handlingCharges;
    const updatedDelivery = localDelivery !== undefined ? parseFloat(localDelivery) : calculation.localDelivery;

    const totalProductCost = updatedProductCost * updatedQuantity;
    const newTotalLandedCost = totalProductCost + updatedFreight + updatedInsurance + updatedCustomsDuty + updatedHandling + updatedDelivery;
    const newCostPerUnit = newTotalLandedCost / updatedQuantity;

    await calculation.update({
      quantity: updatedQuantity,
      productCost: updatedProductCost,
      freight: updatedFreight,
      insurance: updatedInsurance,
      customsDuty: updatedCustomsDuty,
      handlingCharges: updatedHandling,
      localDelivery: updatedDelivery,
      totalLandedCost: newTotalLandedCost,
      costPerUnit: newCostPerUnit,
      exchangeRate: exchangeRate !== undefined ? parseFloat(exchangeRate) : calculation.exchangeRate,
      notes: notes !== undefined ? notes : calculation.notes
    });

    const result = await db.LandedCostCalculation.findByPk(id, {
      include: [
        { model: db.Product, as: 'product', attributes: ['id', 'name', 'sku'] },
        { model: db.Factory, as: 'supplier', attributes: ['id', 'name'] }
      ]
    });

    res.json(getSuccessResponse(result, 'Calculation updated successfully'));

    auditService.logAction(req.user.id, 'UPDATE', 'LandedCostCalculation', id, { before: beforeSnapshot, after: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete calculation
 */
const deleteCalculation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const calculation = await db.LandedCostCalculation.findByPk(id);
    if (!calculation) {
      throw new NotFoundError('Landed cost calculation not found');
    }

    // Mark as deleted by setting deletedAt if the model supports soft deletes
    if (calculation.destroy) {
      await calculation.destroy();
    }

    res.json(getSuccessResponse({ id }, 'Calculation deleted successfully'));

    auditService.logAction(req.user.id, 'DELETE', 'LandedCostCalculation', id, {}, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get all templates
 */
const getTemplates = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, supplierId, active = true, search } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (supplierId) where.supplierId = supplierId;
    if (active !== undefined) where.isActive = active === 'true' || active === true;
    if (search) where.name = { [Op.like]: `%${search}%` };

    const [count, rows] = await Promise.all([
      db.LandedCostTemplate.count({ where }),
      db.LandedCostTemplate.findAll({
        where,
        include: [
          { model: db.Factory, as: 'supplier', attributes: ['id', 'name'] }
        ],
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

/**
 * Get template by ID
 */
const getTemplateById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const template = await db.LandedCostTemplate.findByPk(id, {
      include: [
        { model: db.Factory, as: 'supplier' }
      ]
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    res.json(getSuccessResponse(template));
  } catch (error) {
    next(error);
  }
};

/**
 * Create new template
 */
const createTemplate = async (req, res, next) => {
  try {
    const {
      name,
      description,
      supplierId,
      countryOfOrigin,
      destinationCountry,
      components,
      defaultPercentages,
      currency = 'USD',
      notes
    } = req.body;

    // Check if template name already exists
    const existingTemplate = await db.LandedCostTemplate.findOne({ where: { name } });
    if (existingTemplate) {
      throw new Error('Template name already exists');
    }

    const template = await db.LandedCostTemplate.create({
      id: uuidv4(),
      name,
      description: description || null,
      supplierId: supplierId || null,
      countryOfOrigin: countryOfOrigin || null,
      destinationCountry: destinationCountry || null,
      components: components || {
        productCost: 0,
        freight: 0,
        insurance: 0,
        customsDuty: 0,
        handlingCharges: 0,
        localDelivery: 0
      },
      defaultPercentages: defaultPercentages || {
        freightPercent: 5,
        insurancePercent: 1,
        customsDutyPercent: 10,
        handlingChargesPercent: 2,
        localDeliveryPercent: 3
      },
      currency,
      isActive: true,
      notes: notes || null,
      createdBy: req.user.id
    });

    const result = await db.LandedCostTemplate.findByPk(template.id, {
      include: [
        { model: db.Factory, as: 'supplier' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Template created successfully'));

    auditService.logAction(req.user.id, 'CREATE', 'LandedCostTemplate', template.id, { data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Update template
 */
const updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      countryOfOrigin,
      destinationCountry,
      components,
      defaultPercentages,
      notes,
      isActive
    } = req.body;

    const template = await db.LandedCostTemplate.findByPk(id);
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    const beforeSnapshot = template.toJSON();

    await template.update({
      name: name || template.name,
      description: description !== undefined ? description : template.description,
      countryOfOrigin: countryOfOrigin || template.countryOfOrigin,
      destinationCountry: destinationCountry || template.destinationCountry,
      components: components || template.components,
      defaultPercentages: defaultPercentages || template.defaultPercentages,
      notes: notes !== undefined ? notes : template.notes,
      isActive: isActive !== undefined ? isActive : template.isActive
    });

    const result = await db.LandedCostTemplate.findByPk(id, {
      include: [
        { model: db.Factory, as: 'supplier' }
      ]
    });

    res.json(getSuccessResponse(result, 'Template updated successfully'));

    auditService.logAction(req.user.id, 'UPDATE', 'LandedCostTemplate', id, { before: beforeSnapshot, after: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete template
 */
const deleteTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const template = await db.LandedCostTemplate.findByPk(id);
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    await template.update({ isActive: false });

    res.json(getSuccessResponse({ id }, 'Template deleted successfully'));

    auditService.logAction(req.user.id, 'DELETE', 'LandedCostTemplate', id, {}, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate landed cost using a template
 */
const calculateWithTemplate = async (req, res, next) => {
  try {
    const {
      templateId,
      productId,
      supplierId,
      quantity,
      productCost,
      purchaseOrderId = null,
      currency = 'USD',
      exchangeRate = 1
    } = req.body;

    // Get template
    const template = await db.LandedCostTemplate.findByPk(templateId);
    if (!template || !template.isActive) {
      throw new NotFoundError('Template not found or inactive');
    }

    // Validate product and supplier
    const product = await db.Product.findByPk(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const supplier = await db.Factory.findByPk(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    // Generate reference number
    const lastCalc = await db.LandedCostCalculation.findOne({
      order: [['createdAt', 'DESC']]
    });
    const counter = incrementCounter(lastCalc?.referenceNumber);
    const referenceNumber = generateNumberWithCounter('LCC', counter);

    // Calculate costs based on template percentages
    const totalProductCost = parseFloat(productCost) * parseFloat(quantity);
    const CIF = totalProductCost; // Cost, Insurance, Freight base

    const freightPercent = template.defaultPercentages?.freightPercent || 5;
    const insurancePercent = template.defaultPercentages?.insurancePercent || 1;
    const dutyPercent = template.defaultPercentages?.customsDutyPercent || 10;
    const handlingPercent = template.defaultPercentages?.handlingChargesPercent || 2;
    const deliveryPercent = template.defaultPercentages?.localDeliveryPercent || 3;

    const freight = (CIF * freightPercent) / 100;
    const insurance = (CIF * insurancePercent) / 100;
    const customsDuty = (CIF * dutyPercent) / 100;
    const handlingCharges = (CIF * handlingPercent) / 100;
    const localDelivery = (CIF * deliveryPercent) / 100;

    const totalLandedCost = CIF + freight + insurance + customsDuty + handlingCharges + localDelivery;
    const costPerUnit = totalLandedCost / parseFloat(quantity);

    const calculation = await db.LandedCostCalculation.create({
      id: uuidv4(),
      referenceNumber,
      productId,
      supplierId,
      quantity: parseFloat(quantity),
      unit: product.unit || 'PCS',
      productCost: parseFloat(productCost),
      freight,
      insurance,
      customsDuty,
      handlingCharges,
      localDelivery,
      totalLandedCost,
      costPerUnit,
      currency,
      exchangeRate: parseFloat(exchangeRate),
      purchaseOrderId: purchaseOrderId || null,
      templateId,
      notes: `Calculated using template: ${template.name}`
    });

    const result = await db.LandedCostCalculation.findByPk(calculation.id, {
      include: [
        { model: db.Product, as: 'product', attributes: ['id', 'name', 'sku'] },
        { model: db.Factory, as: 'supplier', attributes: ['id', 'name'] },
        { model: db.LandedCostTemplate, as: 'template', attributes: ['id', 'name'] }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Landed cost calculated using template'));

    auditService.logAction(req.user.id, 'CREATE', 'LandedCostCalculation', calculation.id, { templateId, data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

module.exports = {
  calculate,
  getCalculations,
  getCalculationById,
  updateCalculation,
  deleteCalculation,
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  calculateWithTemplate
};
