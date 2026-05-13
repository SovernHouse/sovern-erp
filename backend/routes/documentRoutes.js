const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth } = require('../middleware/auth');
const { brandScope } = require('../middleware/brandScope');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const documentVersionController = require('../controllers/documentVersionController');

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const templateDir = path.join(uploadDir, 'templates');
const documentDir = path.join(uploadDir, 'documents');

[templateDir, documentDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = req.body.type === 'template' ? templateDir : documentDir;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'text/html',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError('File type not allowed'));
    }
  }
});

// Phase 1 Commit 3b-B: brand-scope every document request.
router.use(requireAuth, brandScope);

// GET / - List documents with filtering
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, type, category, entityType, entityId, search } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { ...(req.brandScope?.where || {}), isActive: true };
    if (type) where.type = type;
    if (category) where.category = category;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { tags: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await db.Document.findAndCountAll({
      where,
      include: [{ model: db.User, as: 'creator', attributes: ['firstName', 'lastName', 'email'] }],
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
});

// GET /templates - List all templates
router.get('/templates', requireAuth, async (req, res, next) => {
  try {
    const { category } = req.query;
    const where = { type: 'template', isActive: true };
    if (category) where.category = category;

    const templates = await db.Document.findAll({
      where,
      include: [{ model: db.User, as: 'creator', attributes: ['firstName', 'lastName'] }],
      order: [['isDefault', 'DESC'], ['name', 'ASC']]
    });

    res.json(getSuccessResponse(templates));
  } catch (error) {
    next(error);
  }
});

// GET /:id - Get single document
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const document = await db.Document.findByPk(req.params.id, {
      include: [{ model: db.User, as: 'creator', attributes: ['firstName', 'lastName', 'email'] }]
    });

    if (!document) throw new NotFoundError('Document not found');
    res.json(getSuccessResponse(document));
  } catch (error) {
    next(error);
  }
});

// POST / - Upload a document
router.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { name, type, category, entityType, entityId, description, tags, templateData, customFields } = req.body;

    if (!name) throw new ValidationError('Document name is required');

    const docData = {
      id: uuidv4(),
      name,
      type: type || 'uploaded',
      category: category || 'other',
      entityType: entityType || null,
      entityId: entityId || null,
      description: description || null,
      tags: tags || null,
      templateData: templateData || null,
      customFields: customFields || null,
      createdBy: req.user.id,
      version: 1,
      isActive: true
    };

    if (req.file) {
      docData.fileUrl = `/uploads/${type === 'template' ? 'templates' : 'documents'}/${req.file.filename}`;
      docData.fileName = req.file.originalname;
      docData.fileSize = req.file.size;
      docData.mimeType = req.file.mimetype;
    }

    const document = await db.Document.create(docData);

    res.status(201).json(getSuccessResponse(document, 'Document uploaded successfully'));

    // Fire-and-forget audit log and real-time notification
    auditService.logAction(req.user.id, 'CREATE', 'Document', document.id, { data: document.toJSON() }, req.ip).catch(() => {});

    // Emit to related users (entity owner, creator, etc)
    const relatedUsers = [req.user.id];
    if (entityType && entityId) {
      // Could add more logic to find related users based on entity type
      // For now just notify the creator
    }
    notificationService.emitDocumentUploaded(document.id, relatedUsers).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// POST /template - Create/upload a template
router.post('/template', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { name, category, description, tags, templateData, customFields, isDefault } = req.body;

    if (!name) throw new ValidationError('Template name is required');
    if (!category) throw new ValidationError('Template category is required');

    // If setting as default, unset other defaults in same category
    if (isDefault === 'true' || isDefault === true) {
      await db.Document.update(
        { isDefault: false },
        { where: { type: 'template', category, isDefault: true } }
      );
    }

    const docData = {
      id: uuidv4(),
      name,
      type: 'template',
      category,
      description: description || null,
      tags: tags || null,
      templateData: templateData || null,
      customFields: customFields || null,
      isDefault: isDefault === 'true' || isDefault === true,
      createdBy: req.user.id,
      version: 1,
      isActive: true
    };

    if (req.file) {
      docData.fileUrl = `/uploads/templates/${req.file.filename}`;
      docData.fileName = req.file.originalname;
      docData.fileSize = req.file.size;
      docData.mimeType = req.file.mimetype;
    }

    const template = await db.Document.create(docData);

    res.status(201).json(getSuccessResponse(template, 'Template created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Document', template.id, { data: template.toJSON(), type: 'template' }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PUT /:id - Update document metadata
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const document = await db.Document.findByPk(req.params.id);
    if (!document) throw new NotFoundError('Document not found');

    const beforeSnapshot = document.toJSON();

    const { name, category, description, tags, templateData, customFields, isDefault } = req.body;

    // If setting as default template, unset others
    if ((isDefault === true || isDefault === 'true') && document.type === 'template') {
      await db.Document.update(
        { isDefault: false },
        { where: { type: 'template', category: category || document.category, isDefault: true, id: { [Op.ne]: document.id } } }
      );
    }

    await document.update({
      name: name || document.name,
      category: category || document.category,
      description: description !== undefined ? description : document.description,
      tags: tags !== undefined ? tags : document.tags,
      templateData: templateData !== undefined ? templateData : document.templateData,
      customFields: customFields !== undefined ? customFields : document.customFields,
      isDefault: isDefault !== undefined ? (isDefault === true || isDefault === 'true') : document.isDefault
    });

    res.json(getSuccessResponse(document, 'Document updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Document', req.params.id, { before: beforeSnapshot, after: document.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PUT /:id/replace - Replace document file (new version)
router.put('/:id/replace', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const document = await db.Document.findByPk(req.params.id);
    if (!document) throw new NotFoundError('Document not found');
    if (!req.file) throw new ValidationError('No file provided');

    const subDir = document.type === 'template' ? 'templates' : 'documents';

    await document.update({
      fileUrl: `/uploads/${subDir}/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      version: document.version + 1
    });

    res.json(getSuccessResponse(document, 'Document file replaced successfully'));
  } catch (error) {
    next(error);
  }
});

// POST /:id/duplicate - Duplicate a template
router.post('/:id/duplicate', requireAuth, async (req, res, next) => {
  try {
    const original = await db.Document.findByPk(req.params.id);
    if (!original) throw new NotFoundError('Document not found');

    const { name } = req.body;

    const duplicate = await db.Document.create({
      id: uuidv4(),
      name: name || `${original.name} (Copy)`,
      type: original.type,
      category: original.category,
      fileUrl: original.fileUrl,
      fileName: original.fileName,
      fileSize: original.fileSize,
      mimeType: original.mimeType,
      templateData: original.templateData,
      customFields: original.customFields,
      description: original.description,
      tags: original.tags,
      isDefault: false,
      createdBy: req.user.id,
      version: 1,
      isActive: true
    });

    res.status(201).json(getSuccessResponse(duplicate, 'Document duplicated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Document', duplicate.id, { data: duplicate.toJSON(), sourceDocumentId: req.params.id }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// POST /customize - Generate a customized document from template
router.post('/customize', requireAuth, async (req, res, next) => {
  try {
    const { templateId, name, entityType, entityId, customFields, overrides } = req.body;

    if (!templateId) throw new ValidationError('Template ID is required');

    const template = await db.Document.findByPk(templateId);
    if (!template) throw new NotFoundError('Template not found');
    if (template.type !== 'template') throw new ValidationError('Source document is not a template');

    // Merge template data with overrides
    let mergedTemplateData = template.templateData;
    if (overrides && template.templateData) {
      try {
        const baseData = JSON.parse(template.templateData);
        mergedTemplateData = JSON.stringify({ ...baseData, ...overrides });
      } catch (e) {
        mergedTemplateData = template.templateData;
      }
    }

    // Merge custom fields
    let mergedCustomFields = template.customFields;
    if (customFields && template.customFields) {
      try {
        const baseFields = JSON.parse(template.customFields);
        mergedCustomFields = JSON.stringify({ ...baseFields, ...customFields });
      } catch (e) {
        mergedCustomFields = JSON.stringify(customFields);
      }
    } else if (customFields) {
      mergedCustomFields = JSON.stringify(customFields);
    }

    const customDoc = await db.Document.create({
      id: uuidv4(),
      name: name || `${template.name} - Customized`,
      type: 'generated',
      category: template.category,
      fileUrl: template.fileUrl,
      fileName: template.fileName,
      fileSize: template.fileSize,
      mimeType: template.mimeType,
      templateData: mergedTemplateData,
      customFields: mergedCustomFields,
      entityType: entityType || null,
      entityId: entityId || null,
      description: `Generated from template: ${template.name}`,
      tags: template.tags,
      createdBy: req.user.id,
      version: 1,
      isActive: true
    });

    res.status(201).json(getSuccessResponse(customDoc, 'Customized document created'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Document', customDoc.id, { data: customDoc.toJSON(), sourceTemplateId: templateId }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /entity/:entityType/:entityId - Get documents for a specific entity
router.get('/entity/:entityType/:entityId', requireAuth, async (req, res, next) => {
  try {
    const documents = await db.Document.findAll({
      where: {
        entityType: req.params.entityType,
        entityId: req.params.entityId,
        isActive: true
      },
      include: [{ model: db.User, as: 'creator', attributes: ['firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(documents));
  } catch (error) {
    next(error);
  }
});

// DELETE /:id - Soft delete document
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const document = await db.Document.findByPk(req.params.id);
    if (!document) throw new NotFoundError('Document not found');

    await document.update({ isActive: false });
    res.json(getSuccessResponse(null, 'Document deactivated'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Document', req.params.id, { action: 'soft_delete' }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// ==================== DOCUMENT VERSION ENDPOINTS ====================

/**
 * Upload a new version of a document
 * @route POST /api/documents/:id/versions
 */
router.post('/:id/versions', requireAuth, upload.single('file'), documentVersionController.uploadNewVersion);

/**
 * List version history for a document
 * @route GET /api/documents/:id/versions
 */
router.get('/:id/versions', requireAuth, documentVersionController.listVersions);

/**
 * Get a specific version
 * @route GET /api/documents/:id/versions/:versionNumber
 */
router.get('/:id/versions/:versionNumber', requireAuth, documentVersionController.getVersion);

/**
 * Revert to a specific version
 * @route POST /api/documents/:id/versions/:versionNumber/revert
 */
router.post('/:id/versions/:versionNumber/revert', requireAuth, documentVersionController.revertToVersion);

/**
 * Delete a specific version
 * @route DELETE /api/documents/:id/versions/:versionNumber
 */
router.delete('/:id/versions/:versionNumber', requireAuth, documentVersionController.deleteVersion);

/**
 * Compare two versions
 * @route GET /api/documents/:id/versions/compare?fromVersion=1&toVersion=2
 */
router.get('/:id/versions-compare', requireAuth, documentVersionController.compareVersions);

/**
 * Get version statistics
 * @route GET /api/documents/:id/versions-stats
 */
router.get('/:id/versions-stats', requireAuth, documentVersionController.getVersionStats);

module.exports = router;
