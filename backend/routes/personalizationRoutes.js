/**
 * Personalization Routes
 * @module routes/personalizationRoutes
 * @description Endpoints for user personalization features: notifications, commissions, and filter presets
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSuccessResponse } = require('../utils/helpers');
const { Op } = require('sequelize');
const crypto = require('crypto');

/**
 * Get user's notification preferences
 * @route GET /api/personalization/notification-preferences/:userId
 */
router.get('/notification-preferences/:userId', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Users can only access their own preferences, unless admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized', statusCode: 403 }
      });
    }

    let prefs = await db.NotificationPreference.findOne({
      where: { userId }
    });

    if (!prefs) {
      prefs = await db.NotificationPreference.create({ userId });
    }

    // Don't expose unsubscribe token to client
    const data = prefs.toJSON();
    delete data.unsubscribeToken;

    res.json(getSuccessResponse(data));
  } catch (error) {
    next(error);
  }
});

/**
 * Update user's notification preferences
 * @route PUT /api/personalization/notification-preferences/:userId
 * @body {Object} preferences - Notification preferences
 * @body {String} digestFrequency - Digest frequency
 * @body {String} digestTime - Digest time
 */
router.put('/notification-preferences/:userId', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { preferences, digestFrequency, digestTime } = req.body;

    // Users can only update their own preferences, unless admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized', statusCode: 403 }
      });
    }

    let prefs = await db.NotificationPreference.findOne({
      where: { userId }
    });

    if (!prefs) {
      prefs = await db.NotificationPreference.create({
        userId,
        preferences: preferences || {},
        digestFrequency: digestFrequency || 'real-time',
        digestTime
      });
    } else {
      await prefs.update({
        preferences: preferences || prefs.preferences,
        digestFrequency: digestFrequency || prefs.digestFrequency,
        digestTime: digestTime || prefs.digestTime
      });
    }

    const data = prefs.toJSON();
    delete data.unsubscribeToken;

    res.json(getSuccessResponse({
      message: 'Notification preferences updated successfully',
      data
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get commission rules
 * @route GET /api/personalization/commissions/rules
 */
router.get('/commissions/rules', requireAuth, requireRole('admin', 'finance'), async (req, res, next) => {
  try {
    const rules = await db.CommissionRule.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(rules));
  } catch (error) {
    next(error);
  }
});

/**
 * Create commission rule
 * @route POST /api/personalization/commissions/rules
 * @body {Object} rule - Commission rule details
 */
router.post('/commissions/rules', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, description, ruleType, baseValue, minAmount, maxAmount, tiers, applicableRoles } = req.body;

    const rule = await db.CommissionRule.create({
      name,
      description,
      ruleType,
      baseValue,
      minAmount,
      maxAmount,
      tiers,
      applicableRoles: applicableRoles || ['sales']
    });

    res.json(getSuccessResponse({
      message: 'Commission rule created successfully',
      data: rule
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get user's commission earnings
 * @route GET /api/personalization/commissions/my
 */
router.get('/commissions/my', requireAuth, async (req, res, next) => {
  try {
    const commissions = await db.CommissionTracking.findAll({
      where: { userId: req.user.id },
      include: [
        { model: db.CommissionRule, as: 'commissionRule', attributes: ['name', 'ruleType'] },
        { model: db.SalesOrder, attributes: ['id', 'orderNumber', 'total', 'createdAt'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    const stats = {
      totalEarned: 0,
      pending: 0,
      approved: 0,
      paid: 0,
      disputed: 0
    };

    commissions.forEach(c => {
      stats.totalEarned += parseFloat(c.amount);
      stats[c.status] = (stats[c.status] || 0) + parseFloat(c.amount);
    });

    res.json(getSuccessResponse({
      stats,
      commissions
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get all user commissions (admin)
 * @route GET /api/personalization/commissions
 */
router.get('/commissions', requireAuth, requireRole('admin', 'finance'), async (req, res, next) => {
  try {
    const { userId, status, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await db.CommissionTracking.findAndCountAll({
      where,
      include: [
        { model: db.User, attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: db.CommissionRule, as: 'commissionRule' },
        { model: db.SalesOrder, attributes: ['id', 'orderNumber'] }
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit)
    });

    res.json(getSuccessResponse({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get user's filter presets
 * @route GET /api/personalization/filter-presets
 */
router.get('/filter-presets', requireAuth, async (req, res, next) => {
  try {
    const { entityType } = req.query;

    const where = { userId: req.user.id };
    if (entityType) where.entityType = entityType;

    const presets = await db.FilterPreset.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(presets));
  } catch (error) {
    next(error);
  }
});

/**
 * Create filter preset
 * @route POST /api/personalization/filter-presets
 * @body {String} entityType - Entity type
 * @body {String} name - Preset name
 * @body {Object} filters - Filter configuration
 * @body {Boolean} isPublic - Whether preset is public
 */
router.post('/filter-presets', requireAuth, async (req, res, next) => {
  try {
    const { entityType, name, filters, isPublic } = req.body;

    let shareToken = null;
    if (isPublic) {
      shareToken = crypto.randomBytes(32).toString('hex');
    }

    const preset = await db.FilterPreset.create({
      userId: req.user.id,
      entityType,
      name,
      filters,
      isPublic,
      shareToken
    });

    res.json(getSuccessResponse({
      message: 'Filter preset created successfully',
      data: preset
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Update filter preset
 * @route PUT /api/personalization/filter-presets/:id
 */
router.put('/filter-presets/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, filters, isPublic, isDefault } = req.body;

    const preset = await db.FilterPreset.findByPk(id);
    if (!preset) {
      return res.status(404).json({
        success: false,
        error: { message: 'Preset not found', statusCode: 404 }
      });
    }

    if (preset.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized', statusCode: 403 }
      });
    }

    let shareToken = preset.shareToken;
    if (isPublic && !shareToken) {
      shareToken = crypto.randomBytes(32).toString('hex');
    } else if (!isPublic) {
      shareToken = null;
    }

    await preset.update({
      name: name || preset.name,
      filters: filters || preset.filters,
      isPublic: isPublic !== undefined ? isPublic : preset.isPublic,
      isDefault: isDefault !== undefined ? isDefault : preset.isDefault,
      shareToken
    });

    res.json(getSuccessResponse({
      message: 'Filter preset updated successfully',
      data: preset
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Delete filter preset
 * @route DELETE /api/personalization/filter-presets/:id
 */
router.delete('/filter-presets/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const preset = await db.FilterPreset.findByPk(id);
    if (!preset) {
      return res.status(404).json({
        success: false,
        error: { message: 'Preset not found', statusCode: 404 }
      });
    }

    if (preset.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized', statusCode: 403 }
      });
    }

    await preset.destroy();

    res.json(getSuccessResponse({
      message: 'Filter preset deleted successfully'
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get public filter preset
 * @route GET /api/personalization/filter-presets/shared/:shareToken
 */
router.get('/filter-presets/shared/:shareToken', async (req, res, next) => {
  try {
    const { shareToken } = req.params;

    const preset = await db.FilterPreset.findOne({
      where: {
        shareToken,
        isPublic: true
      },
      attributes: { exclude: ['userId'] }
    });

    if (!preset) {
      return res.status(404).json({
        success: false,
        error: { message: 'Shared preset not found', statusCode: 404 }
      });
    }

    res.json(getSuccessResponse(preset));
  } catch (error) {
    next(error);
  }
});

// ========================================================================
// DOCUMENT TEMPLATE MANAGEMENT
// ========================================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const templateService = require('../services/templateProcessingService');

const uploadsDir = path.join(__dirname, '..', 'uploads', 'templates');
fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.html'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

/**
 * Get all document types and their field definitions
 * @route GET /api/personalization/templates/document-types
 */
router.get('/templates/document-types', requireAuth, async (req, res, next) => {
  try {
    const types = templateService.getDocumentTypes();
    res.json(getSuccessResponse(types));
  } catch (error) {
    next(error);
  }
});

/**
 * Get field definitions for a specific document type
 * @route GET /api/personalization/templates/fields/:documentType
 */
router.get('/templates/fields/:documentType', requireAuth, async (req, res, next) => {
  try {
    const fields = templateService.getFieldDefinitions(req.params.documentType);
    if (!fields) {
      return res.status(404).json({ success: false, error: { message: 'Document type not found', statusCode: 404 } });
    }
    res.json(getSuccessResponse(fields));
  } catch (error) {
    next(error);
  }
});

/**
 * List all document templates
 * @route GET /api/personalization/templates
 */
router.get('/templates', requireAuth, async (req, res, next) => {
  try {
    const { documentType, isActive, page = 1, limit = 50 } = req.query;
    const where = {};
    if (documentType) where.documentType = documentType;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const offset = (page - 1) * limit;
    const { count, rows } = await db.DocumentTemplate.findAndCountAll({
      where,
      include: [{ model: db.User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit)
    });

    res.json(getSuccessResponse({
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get a single document template
 * @route GET /api/personalization/templates/:id
 */
router.get('/templates/:id', requireAuth, async (req, res, next) => {
  try {
    const template = await db.DocumentTemplate.findByPk(req.params.id, {
      include: [{ model: db.User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }]
    });
    if (!template) return res.status(404).json({ success: false, error: { message: 'Template not found', statusCode: 404 } });
    res.json(getSuccessResponse(template));
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new document template
 * @route POST /api/personalization/templates
 */
router.post('/templates', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, documentType, description, headerHtml, bodyHtml, footerHtml, customCss,
            companyInfo, pageSettings, templateFields, placeholderMappings, isDefault } = req.body;

    // If setting as default, unset other defaults of same type
    if (isDefault) {
      await db.DocumentTemplate.update({ isDefault: false }, { where: { documentType, isDefault: true } });
    }

    // Use default template HTML if none provided
    const defaultHtml = templateService.getDefaultTemplate(documentType);

    const template = await db.DocumentTemplate.create({
      name,
      documentType,
      description,
      headerHtml: headerHtml || '',
      bodyHtml: bodyHtml || defaultHtml,
      footerHtml: footerHtml || '',
      customCss: customCss || '',
      companyInfo: companyInfo || {},
      pageSettings: pageSettings || { size: 'A4', orientation: 'portrait', margins: { top: 20, right: 20, bottom: 20, left: 20 } },
      templateFields: templateFields || [],
      placeholderMappings: placeholderMappings || {},
      isDefault: isDefault || false,
      createdBy: req.user.id
    });

    res.status(201).json(getSuccessResponse({ message: 'Template created successfully', data: template }));
  } catch (error) {
    next(error);
  }
});

/**
 * Update a document template
 * @route PUT /api/personalization/templates/:id
 */
router.put('/templates/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const template = await db.DocumentTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: { message: 'Template not found', statusCode: 404 } });

    const { isDefault, documentType } = req.body;
    if (isDefault) {
      await db.DocumentTemplate.update({ isDefault: false }, { where: { documentType: documentType || template.documentType, isDefault: true } });
    }

    await template.update({
      ...req.body,
      versionNumber: template.versionNumber + 1
    });

    res.json(getSuccessResponse({ message: 'Template updated successfully', data: template }));
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a document template
 * @route DELETE /api/personalization/templates/:id
 */
router.delete('/templates/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const template = await db.DocumentTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: { message: 'Template not found', statusCode: 404 } });
    await template.destroy();
    res.json(getSuccessResponse({ message: 'Template deleted successfully' }));
  } catch (error) {
    next(error);
  }
});

/**
 * Preview a template with sample data
 * @route POST /api/personalization/templates/:id/preview
 */
router.post('/templates/:id/preview', requireAuth, async (req, res, next) => {
  try {
    const template = await db.DocumentTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: { message: 'Template not found', statusCode: 404 } });

    const sampleData = req.body.sampleData || {};
    const html = templateService.generateHtml(
      template.bodyHtml || templateService.getDefaultTemplate(template.documentType),
      sampleData,
      template.companyInfo || {}
    );

    res.json(getSuccessResponse({ html }));
  } catch (error) {
    next(error);
  }
});

/**
 * Generate a document from a template using a source entity
 * @route POST /api/personalization/templates/:id/generate
 */
router.post('/templates/:id/generate', requireAuth, async (req, res, next) => {
  try {
    const template = await db.DocumentTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: { message: 'Template not found', statusCode: 404 } });

    const { sourceEntityType, sourceEntityId, fieldOverrides } = req.body;

    // Create generation record
    const generation = await db.TemplateGeneration.create({
      templateId: template.id,
      sourceEntityType,
      sourceEntityId,
      generatedBy: req.user.id,
      status: 'pending'
    });

    try {
      // Fetch source entity data
      let sourceData = {};
      const modelMap = {
        sales_order: 'SalesOrder',
        purchase_order: 'PurchaseOrder',
        invoice: 'Invoice',
        quotation: 'Quotation',
        packing_list: 'PackingList'
      };

      const modelName = modelMap[sourceEntityType];
      if (modelName && db[modelName]) {
        sourceData = await db[modelName].findByPk(sourceEntityId, { include: [{ all: true, nested: true }] });
        if (sourceData) sourceData = sourceData.toJSON();
      }

      // Extract field values and apply overrides
      const fieldDefs = templateService.getFieldDefinitions(template.documentType);
      let fieldValues = fieldDefs ? templateService.extractFieldValues(sourceData, fieldDefs.fields) : sourceData;
      if (fieldOverrides) fieldValues = { ...fieldValues, ...fieldOverrides };

      // Generate HTML
      const html = templateService.generateHtml(
        template.bodyHtml || templateService.getDefaultTemplate(template.documentType),
        fieldValues,
        template.companyInfo || {}
      );

      // Save generation
      const outputPath = path.join(uploadsDir, `generated-${generation.id}.html`);
      await fs.writeFile(outputPath, html);

      await generation.update({
        status: 'generated',
        generatedFileUrl: `/uploads/templates/generated-${generation.id}.html`,
        fieldValues
      });

      res.json(getSuccessResponse({ message: 'Document generated successfully', data: { generation, html } }));
    } catch (genError) {
      await generation.update({ status: 'failed', errorMessage: genError.message });
      throw genError;
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Upload a file template (Excel/Word/PDF) and analyze it
 * @route POST /api/personalization/templates/upload-analyze
 */
router.post('/templates/upload-analyze', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { message: 'No file uploaded', statusCode: 400 } });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let analysis = { fileName: req.file.originalname, fileType: ext.replace('.', ''), filePath: req.file.path };

    if (ext === '.xlsx' || ext === '.xls') {
      const excelAnalysis = await templateService.analyzeExcelTemplate(req.file.path);
      analysis = { ...analysis, ...excelAnalysis };
    }

    res.json(getSuccessResponse({ message: 'File analyzed successfully', data: analysis }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get template generation history
 * @route GET /api/personalization/templates/generations/history
 */
router.get('/templates/generations/history', requireAuth, async (req, res, next) => {
  try {
    const { templateId, status, page = 1, limit = 50 } = req.query;
    const where = {};
    if (templateId) where.templateId = templateId;
    if (status) where.status = status;

    const offset = (page - 1) * limit;
    const { count, rows } = await db.TemplateGeneration.findAndCountAll({
      where,
      include: [
        { model: db.DocumentTemplate, as: 'template', attributes: ['id', 'name', 'documentType'] },
        { model: db.User, as: 'generator', attributes: ['id', 'firstName', 'lastName'] }
      ],
      order: [['generatedAt', 'DESC']],
      offset,
      limit: parseInt(limit)
    });

    res.json(getSuccessResponse({
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
    }));
  } catch (error) {
    next(error);
  }
});

// ========================================================================
// PRODUCT ATTRIBUTES / CUSTOM SPECS
// ========================================================================

/**
 * Get product attributes (optionally filtered by category)
 * @route GET /api/personalization/product-attributes
 */
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
// PRICE LISTS
// ========================================================================

/**
 * List price lists
 * @route GET /api/personalization/price-lists
 */
router.get('/price-lists', requireAuth, async (req, res, next) => {
  try {
    const { customerId, factoryId, isActive, page = 1, limit = 50 } = req.query;
    const where = {};
    if (customerId) where.customerId = customerId;
    if (factoryId) where.factoryId = factoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const offset = (page - 1) * limit;
    const { count, rows } = await db.PriceList.findAndCountAll({
      where,
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.Factory, attributes: ['id', 'companyName'] },
        { model: db.User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit)
    });

    res.json(getSuccessResponse({
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get a price list with items
 * @route GET /api/personalization/price-lists/:id
 */
router.get('/price-lists/:id', requireAuth, async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id, {
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.Factory, attributes: ['id', 'companyName'] },
        { model: db.PriceListItem, as: 'items', include: [{ model: db.Product, attributes: ['id', 'name', 'sku'] }] },
        { model: db.User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
      ]
    });
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });
    res.json(getSuccessResponse(priceList));
  } catch (error) {
    next(error);
  }
});

/**
 * Create a price list
 * @route POST /api/personalization/price-lists
 */
router.post('/price-lists', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { items, ...listData } = req.body;
    const priceList = await db.PriceList.create({ ...listData, createdBy: req.user.id });

    if (items && items.length > 0) {
      const itemsWithListId = items.map(item => ({ ...item, priceListId: priceList.id }));
      await db.PriceListItem.bulkCreate(itemsWithListId);
    }

    const result = await db.PriceList.findByPk(priceList.id, {
      include: [{ model: db.PriceListItem, as: 'items' }]
    });

    res.status(201).json(getSuccessResponse({ message: 'Price list created', data: result }));
  } catch (error) {
    next(error);
  }
});

/**
 * Update a price list
 * @route PUT /api/personalization/price-lists/:id
 */
router.put('/price-lists/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id);
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });

    const { items, ...listData } = req.body;
    await priceList.update(listData);

    if (items) {
      await db.PriceListItem.destroy({ where: { priceListId: priceList.id } });
      if (items.length > 0) {
        const itemsWithListId = items.map(item => ({ ...item, priceListId: priceList.id }));
        await db.PriceListItem.bulkCreate(itemsWithListId);
      }
    }

    const result = await db.PriceList.findByPk(priceList.id, {
      include: [{ model: db.PriceListItem, as: 'items' }]
    });

    res.json(getSuccessResponse({ message: 'Price list updated', data: result }));
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a price list
 * @route DELETE /api/personalization/price-lists/:id
 */
router.delete('/price-lists/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id);
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });
    await db.PriceListItem.destroy({ where: { priceListId: priceList.id } });
    await priceList.destroy();
    res.json(getSuccessResponse({ message: 'Price list deleted' }));
  } catch (error) {
    next(error);
  }
});

/**
 * Export a price list to Excel
 * @route GET /api/personalization/price-lists/:id/export
 */
router.get('/price-lists/:id/export', requireAuth, async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id, {
      include: [{ model: db.PriceListItem, as: 'items' }]
    });
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });

    const columns = [
      { key: 'sku', label: 'SKU', width: 15 },
      { key: 'productName', label: 'Product Name', width: 30 },
      { key: 'sellingPrice', label: 'Selling Price', width: 15 },
      { key: 'costPrice', label: 'Cost Price', width: 15 },
      { key: 'minimumOrder', label: 'Min Order', width: 12 },
      { key: 'leadTimeDays', label: 'Lead Time (days)', width: 15 },
      { key: 'unit', label: 'Unit', width: 10 },
      { key: 'notes', label: 'Notes', width: 25 }
    ];

    const rows = priceList.items.map(item => item.toJSON());
    const workbook = await templateService.generateExcel(rows, columns, priceList.name);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${priceList.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

/**
 * Import items into a price list from Excel/CSV
 * @route POST /api/personalization/price-lists/:id/import
 */
router.post('/price-lists/:id/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id);
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });
    if (!req.file) return res.status(400).json({ success: false, error: { message: 'No file uploaded', statusCode: 400 } });

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const parsed = await templateService.parseImportFile(req.file.path, ext);

    // Map parsed rows to price list items
    const columnMapping = req.body.columnMapping ? JSON.parse(req.body.columnMapping) : {};
    const items = parsed.rows.map(row => {
      const item = { priceListId: priceList.id };
      // Auto-map common column names
      for (const [header, value] of Object.entries(row)) {
        const lower = header.toLowerCase().replace(/[^a-z]/g, '');
        const mapped = columnMapping[header];
        if (mapped) { item[mapped] = value; }
        else if (lower.includes('sku')) { item.sku = value; }
        else if (lower.includes('product') && lower.includes('name')) { item.productName = value; }
        else if (lower.includes('selling') || lower === 'price') { item.sellingPrice = parseFloat(value) || 0; }
        else if (lower.includes('cost')) { item.costPrice = parseFloat(value) || 0; }
        else if (lower.includes('min')) { item.minimumOrder = parseFloat(value) || 0; }
        else if (lower.includes('lead')) { item.leadTimeDays = parseInt(value) || 0; }
        else if (lower.includes('unit')) { item.unit = value; }
        else if (lower.includes('note')) { item.notes = value; }
      }
      return item;
    });

    // Replace or append
    const mode = req.body.mode || 'append';
    if (mode === 'replace') {
      await db.PriceListItem.destroy({ where: { priceListId: priceList.id } });
    }

    await db.PriceListItem.bulkCreate(items);

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {});

    res.json(getSuccessResponse({
      message: `Imported ${items.length} items (${mode} mode)`,
      data: { importedCount: items.length, headers: parsed.headers }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Import products from Excel/CSV
 * @route POST /api/personalization/products/import
 */
router.post('/products/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { message: 'No file uploaded', statusCode: 400 } });

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const parsed = await templateService.parseImportFile(req.file.path, ext);

    // Clean up
    await fs.unlink(req.file.path).catch(() => {});

    // Return parsed data for user to review and map columns before confirming
    res.json(getSuccessResponse({
      message: 'File parsed successfully. Review the data and confirm import.',
      data: {
        headers: parsed.headers,
        sampleRows: parsed.rows.slice(0, 5),
        totalRows: parsed.rowCount
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Confirm product import with column mapping
 * @route POST /api/personalization/products/import/confirm
 */
router.post('/products/import/confirm', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows, columnMapping, categoryId } = req.body;
    if (!rows || !Array.isArray(rows)) return res.status(400).json({ success: false, error: { message: 'rows is required', statusCode: 400 } });

    let created = 0, updated = 0, errors = [];

    for (const row of rows) {
      try {
        const productData = {};
        for (const [sourceCol, targetField] of Object.entries(columnMapping || {})) {
          productData[targetField] = row[sourceCol];
        }
        if (categoryId) productData.categoryId = categoryId;

        // Try to find by SKU for upsert
        if (productData.sku) {
          const existing = await db.Product.findOne({ where: { sku: productData.sku } });
          if (existing) {
            await existing.update(productData);
            updated++;
          } else {
            await db.Product.create(productData);
            created++;
          }
        } else {
          await db.Product.create(productData);
          created++;
        }
      } catch (rowError) {
        errors.push({ row, error: rowError.message });
      }
    }

    res.json(getSuccessResponse({
      message: `Import complete: ${created} created, ${updated} updated, ${errors.length} errors`,
      data: { created, updated, errors: errors.slice(0, 10) }
    }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
