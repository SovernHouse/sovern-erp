const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

// All flooring-specific spec fields
const SPEC_FIELDS = [
  'flooringType', 'coreType', 'construction',
  'length', 'width', 'thickness', 'wearLayerThickness', 'wearLayerMil',
  'acRating', 'waterproof', 'fireRating', 'slipRating',
  'surfaceFinish', 'surfaceTexture', 'colorPattern', 'edgeType',
  'woodSpecies', 'woodGrade',
  'installationMethod', 'clickSystem', 'underlaymentRequired', 'underlaymentType',
  'sqftPerBox', 'sqmPerBox', 'planksPerBox', 'boxWeight',
  'warrantyResidential', 'warrantyCommercial', 'certifications', 'origin',
  'format', 'notes'
];

const NUMERIC_FIELDS = [
  'length', 'width', 'thickness', 'wearLayerThickness',
  'sqftPerBox', 'sqmPerBox', 'boxWeight'
];

const INT_FIELDS = ['wearLayerMil', 'planksPerBox'];

const parseSpecValue = (key, value) => {
  if (value === undefined || value === null || value === '') return null;
  if (NUMERIC_FIELDS.includes(key)) return parseFloat(value);
  if (INT_FIELDS.includes(key)) return parseInt(value);
  if (key === 'waterproof') return value === true || value === 'true';
  return value;
};

const createSpecs = async (req, res, next) => {
  try {
    const { id: productId } = req.params;

    const product = await db.Product.findByPk(productId);
    if (!product) throw new NotFoundError('Product not found');

    const existingSpec = await db.ProductSpecification.findOne({ where: { productId } });
    if (existingSpec) throw new ValidationError('Specifications already exist for this product');

    const specData = { id: uuidv4(), productId, updatedBy: req.user?.id };
    SPEC_FIELDS.forEach(key => {
      if (req.body[key] !== undefined) {
        specData[key] = parseSpecValue(key, req.body[key]);
      }
    });

    const spec = await db.ProductSpecification.create(specData);

    const result = await db.ProductSpecification.findByPk(spec.id, {
      include: [{ model: db.Product, as: 'product' }]
    });

    res.status(201).json(getSuccessResponse(result, 'Product specifications created successfully'));
    auditService.logAction(req.user?.id, 'CREATE', 'ProductSpecification', spec.id, { data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getSpecs = async (req, res, next) => {
  try {
    const { id: productId } = req.params;

    const product = await db.Product.findByPk(productId);
    if (!product) throw new NotFoundError('Product not found');

    const spec = await db.ProductSpecification.findOne({
      where: { productId },
      include: [{ model: db.Product, as: 'product' }]
    });

    if (!spec) throw new NotFoundError('Specifications not found for this product');

    res.json(getSuccessResponse(spec, 'Product specifications retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const updateSpecs = async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const updates = req.body;

    const spec = await db.ProductSpecification.findOne({ where: { productId } });
    if (!spec) throw new NotFoundError('Specifications not found for this product');

    const filteredUpdates = {};
    SPEC_FIELDS.forEach(key => {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = parseSpecValue(key, updates[key]);
      }
    });

    filteredUpdates.updatedBy = req.user?.id;
    filteredUpdates.lastUpdated = new Date();

    await spec.update(filteredUpdates);

    const result = await db.ProductSpecification.findByPk(spec.id, {
      include: [{ model: db.Product, as: 'product' }]
    });

    res.json(getSuccessResponse(result, 'Product specifications updated successfully'));
    auditService.logAction(req.user?.id, 'UPDATE', 'ProductSpecification', spec.id, { data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const filterBySpecs = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 10,
      flooringType, acRating, waterproof, clickSystem, woodSpecies, search
    } = req.query;

    const { offset } = getPagination(page, limit);
    const where = {};

    if (flooringType) where.flooringType = flooringType;
    if (acRating) where.acRating = acRating;
    if (waterproof !== undefined) where.waterproof = waterproof === 'true';
    if (clickSystem) where.clickSystem = clickSystem;
    if (woodSpecies) where.woodSpecies = { [Op.like]: `%${woodSpecies}%` };

    const { count, rows } = await db.ProductSpecification.findAndCountAll({
      where,
      include: [{
        model: db.Product,
        as: 'product',
        where: search ? {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { sku: { [Op.like]: `%${search}%` } }
          ]
        } : undefined
      }],
      offset,
      limit: parseInt(limit),
      order: [['lastUpdated', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
};

const compareSpecs = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length < 2 || productIds.length > 4) {
      throw new ValidationError('Must provide 2-4 product IDs for comparison');
    }

    const specs = await db.ProductSpecification.findAll({
      where: { productId: productIds },
      include: [{ model: db.Product, as: 'product' }],
      order: [['productId', 'ASC']]
    });

    if (specs.length !== productIds.length) {
      throw new NotFoundError('One or more products do not have specifications');
    }

    const comparison = specs.map(spec => {
      const data = { productId: spec.productId, productName: spec.product.name, productSku: spec.product.sku };
      SPEC_FIELDS.forEach(key => { data[key] = spec[key]; });
      return data;
    });

    res.json(getSuccessResponse(comparison, 'Product specifications comparison retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const getTemplate = async (req, res, next) => {
  try {
    const template = {
      flooringType: '', coreType: '', construction: '',
      length: null, width: null, thickness: null,
      wearLayerThickness: null, wearLayerMil: null,
      acRating: '', waterproof: false, fireRating: '', slipRating: '',
      surfaceFinish: '', surfaceTexture: '', colorPattern: '', edgeType: '',
      woodSpecies: '', woodGrade: '',
      installationMethod: '', clickSystem: '', underlaymentRequired: '', underlaymentType: '',
      sqftPerBox: null, sqmPerBox: null, planksPerBox: null, boxWeight: null,
      warrantyResidential: '', warrantyCommercial: '',
      certifications: [], origin: '', format: '', notes: ''
    };

    res.json(getSuccessResponse(template, 'Specification template retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// ── Spec Template CRUD ──

const TEMPLATE_FIELDS = [
  'name', 'flooringType', 'description',
  'coreType', 'construction',
  'dimensionLength', 'dimensionWidth', 'dimensionThickness',
  'wearLayerThickness', 'wearLayerMil',
  'acRating', 'waterproof', 'fireRating', 'slipRating',
  'surfaceFinish', 'surfaceTexture', 'edgeType',
  'woodSpecies', 'woodGrade',
  'installationMethod', 'clickSystem', 'underlaymentRequired', 'underlaymentType',
  'sqftPerBox', 'sqmPerBox', 'planksPerBox',
  'warrantyResidential', 'warrantyCommercial', 'certifications',
  'format', 'isActive'
];

const TEMPLATE_NUMERIC = ['dimensionLength', 'dimensionWidth', 'dimensionThickness', 'wearLayerThickness', 'sqftPerBox', 'sqmPerBox'];
const TEMPLATE_INT = ['wearLayerMil', 'planksPerBox'];

const getSpecTemplates = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, flooringType } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { isActive: true };
    if (flooringType) where.flooringType = flooringType;

    const { count, rows } = await db.SpecTemplate.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      subQuery: false
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
};

const getSpecTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await db.SpecTemplate.findByPk(id);
    if (!template) throw new NotFoundError('Specification template not found');

    res.json(getSuccessResponse(template, 'Specification template retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const createSpecTemplate = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) throw new ValidationError('Template name is required');

    const templateData = { createdBy: req.user?.id, isActive: true };
    TEMPLATE_FIELDS.forEach(key => {
      if (req.body[key] !== undefined) {
        if (TEMPLATE_NUMERIC.includes(key)) {
          templateData[key] = parseFloat(req.body[key]);
        } else if (TEMPLATE_INT.includes(key)) {
          templateData[key] = parseInt(req.body[key]);
        } else if (key === 'waterproof') {
          templateData[key] = req.body[key] === true || req.body[key] === 'true';
        } else {
          templateData[key] = req.body[key];
        }
      }
    });
    templateData.name = name.trim();

    const template = await db.SpecTemplate.create(templateData);
    res.status(201).json(getSuccessResponse(template, 'Specification template created successfully'));
    auditService.logAction(req.user?.id, 'CREATE', 'SpecTemplate', template.id, { data: template?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const updateSpecTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const template = await db.SpecTemplate.findByPk(id);
    if (!template) throw new NotFoundError('Specification template not found');

    const filteredUpdates = {};
    TEMPLATE_FIELDS.forEach(key => {
      if (updates[key] !== undefined) {
        if (TEMPLATE_NUMERIC.includes(key)) {
          filteredUpdates[key] = parseFloat(updates[key]);
        } else if (TEMPLATE_INT.includes(key)) {
          filteredUpdates[key] = parseInt(updates[key]);
        } else if (key === 'waterproof') {
          filteredUpdates[key] = updates[key] === true || updates[key] === 'true';
        } else {
          filteredUpdates[key] = updates[key];
        }
      }
    });

    await template.update(filteredUpdates);

    const result = await db.SpecTemplate.findByPk(template.id);
    res.json(getSuccessResponse(result, 'Specification template updated successfully'));
    auditService.logAction(req.user?.id, 'UPDATE', 'SpecTemplate', template.id, { data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const deleteSpecTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await db.SpecTemplate.findByPk(id);
    if (!template) throw new NotFoundError('Specification template not found');

    await template.destroy();
    res.json(getSuccessResponse(null, 'Specification template deleted successfully'));
    auditService.logAction(req.user?.id, 'DELETE', 'SpecTemplate', id, { message: 'Template deleted' }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const applySpecTemplate = async (req, res, next) => {
  try {
    const { id: templateId } = req.params;
    const { productId, overrides } = req.body;

    if (!productId) throw new ValidationError('Product ID is required');

    const template = await db.SpecTemplate.findByPk(templateId);
    if (!template) throw new NotFoundError('Specification template not found');

    const product = await db.Product.findByPk(productId);
    if (!product) throw new NotFoundError('Product not found');

    let productSpec = await db.ProductSpecification.findOne({ where: { productId } });

    // Map template fields to product spec fields
    const specData = {
      productId,
      flooringType: template.flooringType,
      coreType: template.coreType,
      construction: template.construction,
      length: template.dimensionLength,
      width: template.dimensionWidth,
      thickness: template.dimensionThickness,
      wearLayerThickness: template.wearLayerThickness,
      wearLayerMil: template.wearLayerMil,
      acRating: template.acRating,
      waterproof: template.waterproof,
      fireRating: template.fireRating,
      slipRating: template.slipRating,
      surfaceFinish: template.surfaceFinish,
      surfaceTexture: template.surfaceTexture,
      edgeType: template.edgeType,
      woodSpecies: template.woodSpecies,
      woodGrade: template.woodGrade,
      installationMethod: template.installationMethod,
      clickSystem: template.clickSystem,
      underlaymentRequired: template.underlaymentRequired,
      underlaymentType: template.underlaymentType,
      sqftPerBox: template.sqftPerBox,
      sqmPerBox: template.sqmPerBox,
      planksPerBox: template.planksPerBox,
      warrantyResidential: template.warrantyResidential,
      warrantyCommercial: template.warrantyCommercial,
      certifications: template.certifications,
      format: template.format,
      updatedBy: req.user?.id,
      lastUpdated: new Date()
    };

    // Apply any overrides
    if (overrides) {
      SPEC_FIELDS.forEach(field => {
        if (overrides[field] !== undefined) {
          specData[field] = parseSpecValue(field, overrides[field]);
        }
      });
    }

    if (productSpec) {
      await productSpec.update(specData);
    } else {
      specData.id = uuidv4();
      productSpec = await db.ProductSpecification.create(specData);
    }

    const result = await db.ProductSpecification.findByPk(productSpec.id, {
      include: [{ model: db.Product, as: 'product' }]
    });

    res.json(getSuccessResponse(result, 'Template applied to product successfully'));
    auditService.logAction(req.user?.id, 'APPLY', 'SpecTemplate', templateId, { productId, result: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSpecs,
  getSpecs,
  updateSpecs,
  filterBySpecs,
  compareSpecs,
  getTemplate,
  getSpecTemplates,
  getSpecTemplate,
  createSpecTemplate,
  updateSpecTemplate,
  deleteSpecTemplate,
  applySpecTemplate
};
