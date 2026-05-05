const express = require('express');
const router = express.Router();
const db = require('../../models');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { getSuccessResponse } = require('../../utils/helpers');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const templateService = require('../../services/templateProcessingService');


const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'templates');
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

module.exports = router;
