/**
 * Inspection Management Routes
 * @module routes/inspectionRoutes
 * @description Endpoints for managing quality inspections including scheduling, reporting, and results
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 * @requires ../services/auditService
 * @requires ../services/emailService
 * @requires ../services/documentGenerator
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const documentGenerator = require('../services/documentGenerator');
const notificationService = require('../services/notificationService');
const webhookService = require('../services/webhookService');

/**
 * List all inspections with pagination and filtering
 * @route GET /api/inspections
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @param {string} status - Filter by inspection status
 * @param {string} type - Filter by inspection type
 * @param {string} factoryId - Filter by factory ID
 * @returns {Object} Paginated list of inspections
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, type, factoryId } = req.query;
    const { offset } = getPagination(page, limit);
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (factoryId) where.factoryId = factoryId;

    const { count, rows } = await db.Inspection.findAndCountAll({
      where,
      include: [
        { model: db.Factory, as: 'factory', attributes: ['companyName'] },
        { model: db.User, as: 'inspector', attributes: ['firstName', 'lastName'] }
      ],
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const inspection = await db.Inspection.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Factory, as: 'factory' },
        { model: db.User, as: 'inspector' },
        { model: db.SalesOrder, as: 'salesOrder' },
        { model: db.PurchaseOrder, as: 'purchaseOrder' },
        { association: 'report' }
      ]
    });

    if (!inspection) throw new NotFoundError('Inspection not found');
    res.json(getSuccessResponse(inspection));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireRole('inspector', 'admin'), async (req, res, next) => {
  try {
    const { type, salesOrderId, purchaseOrderId, factoryId, scheduledDate, items } = req.body;

    const factory = await db.Factory.findByPk(factoryId);
    if (!factory) throw new NotFoundError('Factory not found');

    const inspection = await db.Inspection.create({
      id: uuidv4(),
      inspectionNumber: `INSP-${Date.now()}`,
      salesOrderId: salesOrderId || null,
      purchaseOrderId: purchaseOrderId || null,
      factoryId,
      inspectorId: req.user.id,
      type,
      scheduledDate: new Date(scheduledDate),
      status: 'scheduled'
    });

    for (const item of items || []) {
      await db.InspectionItem.create({
        id: uuidv4(),
        inspectionId: inspection.id,
        productId: item.productId,
        checkPoint: item.checkPoint,
        criteria: item.criteria
      });
    }

    res.status(201).json(getSuccessResponse(inspection, 'Inspection scheduled'));

    // Fire-and-forget email, audit log, real-time notification, and webhooks
    emailService.sendInspectionScheduledEmail(factory, inspection).catch(err => console.error('[EMAIL] Error:', err.message));
    auditService.logAction(req.user.id, 'CREATE', 'Inspection', inspection.id, { data: inspection.toJSON() }, req.ip).catch(() => {});
    const factoryUser = await db.User.findOne({ where: { factoryId: factoryId }, attributes: ['id'] }).catch(() => null);
    if (factoryUser) {
      notificationService.emitInspectionScheduled(inspection.id, factoryUser.id, inspection.scheduledDate).catch(() => {});
    }
    webhookService.triggerWebhook('inspection.scheduled', {
      inspectionId: inspection.id,
      inspectionNumber: inspection.inspectionNumber,
      type: inspection.type,
      factoryId: inspection.factoryId,
      scheduledDate: inspection.scheduledDate,
      inspectorId: inspection.inspectorId,
      status: inspection.status,
      createdAt: inspection.createdAt
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/start', requireAuth, requireRole('inspector', 'admin'), async (req, res, next) => {
  try {
    const inspection = await db.Inspection.findByPk(req.params.id);
    if (!inspection) throw new NotFoundError('Inspection not found');

    await inspection.update({ status: 'in_progress' });
    res.json(getSuccessResponse(inspection, 'Inspection started'));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/complete', requireAuth, requireRole('inspector', 'admin'), async (req, res, next) => {
  try {
    const { overallResult, findings } = req.body;
    const inspection = await db.Inspection.findByPk(req.params.id, {
      include: [{ association: 'items' }]
    });

    if (!inspection) throw new NotFoundError('Inspection not found');

    const passCount = inspection.items.filter(i => i.result === 'pass').length;
    const failCount = inspection.items.filter(i => i.result === 'fail').length;

    await inspection.update({
      status: 'completed',
      completedDate: new Date(),
      overallResult: overallResult || (failCount === 0 ? 'pass' : 'fail')
    });

    const report = await db.InspectionReport.create({
      id: uuidv4(),
      inspectionId: inspection.id,
      reportNumber: `INSP-RPT-${Date.now()}`,
      summary: `Inspection ${inspection.inspectionNumber} - ${passCount} passed, ${failCount} failed`,
      findings: findings || [],
      generatedAt: new Date()
    });

    res.json(getSuccessResponse(inspection, 'Inspection completed'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/items/:itemId', requireAuth, requireRole('inspector', 'admin'), async (req, res, next) => {
  try {
    const { result, value, notes, images } = req.body;
    const item = await db.InspectionItem.findByPk(req.params.itemId);

    if (!item) throw new NotFoundError('Inspection item not found');

    await item.update({ result, value, notes, images: images || [] });
    res.json(getSuccessResponse(item, 'Item updated'));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/report', requireAuth, async (req, res, next) => {
  try {
    const report = await db.InspectionReport.findOne({
      where: { inspectionId: req.params.id }
    });

    if (!report) throw new NotFoundError('Report not found');
    res.json(getSuccessResponse(report));
  } catch (error) {
    next(error);
  }
});

// PATCH /:id/reschedule - Reschedule an inspection
router.patch('/:id/reschedule', requireAuth, requireRole('inspector', 'admin'), async (req, res, next) => {
  try {
    const { scheduledDate, reason } = req.body;
    const inspection = await db.Inspection.findByPk(req.params.id);
    if (!inspection) throw new NotFoundError('Inspection not found');

    const beforeSnapshot = inspection.toJSON();

    if (inspection.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot reschedule a completed inspection' });
    }

    await inspection.update({
      scheduledDate: new Date(scheduledDate),
      notes: inspection.notes ? `${inspection.notes}\nRescheduled: ${reason || 'No reason given'}` : `Rescheduled: ${reason || 'No reason given'}`
    });

    const updatedInspection = await db.Inspection.findByPk(inspection.id);

    res.json(getSuccessResponse(updatedInspection, 'Inspection rescheduled'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Inspection', inspection.id, { action: 'rescheduled', reason, before: beforeSnapshot, after: updatedInspection?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PUT /:id/report - Update or add recommendations to report
router.put('/:id/report', requireAuth, requireRole('inspector', 'admin'), async (req, res, next) => {
  try {
    const { summary, findings, recommendations, images, fileUrl } = req.body;

    let report = await db.InspectionReport.findOne({
      where: { inspectionId: req.params.id }
    });

    const isCreating = !report;
    const beforeSnapshot = report?.toJSON?.();

    if (!report) {
      report = await db.InspectionReport.create({
        id: uuidv4(),
        inspectionId: req.params.id,
        reportNumber: `INSP-RPT-${Date.now()}`,
        summary: summary || '',
        findings: findings || [],
        recommendations: Array.isArray(recommendations) ? JSON.stringify(recommendations) : (recommendations || null),
        images: images || [],
        fileUrl: fileUrl || null,
        generatedAt: new Date()
      });
    } else {
      await report.update({
        summary: summary !== undefined ? summary : report.summary,
        findings: findings !== undefined ? findings : report.findings,
        recommendations: recommendations !== undefined ? (Array.isArray(recommendations) ? JSON.stringify(recommendations) : recommendations) : report.recommendations,
        images: images !== undefined ? images : report.images,
        fileUrl: fileUrl !== undefined ? fileUrl : report.fileUrl
      });
    }

    res.json(getSuccessResponse(report, 'Report updated'));

    // Fire-and-forget audit log
    const action = isCreating ? 'CREATE' : 'UPDATE';
    const changes = isCreating
      ? { data: report.toJSON() }
      : { before: beforeSnapshot, after: report.toJSON() };
    auditService.logAction(req.user.id, action, 'Inspection', req.params.id, changes, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// DELETE /:id - Cancel inspection
router.delete('/:id', requireAuth, requireRole('inspector', 'admin'), async (req, res, next) => {
  try {
    const inspection = await db.Inspection.findByPk(req.params.id);
    if (!inspection) throw new NotFoundError('Inspection not found');

    const previousStatus = inspection.status;

    if (inspection.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed inspection' });
    }

    await inspection.update({ status: 'cancelled' });
    res.json(getSuccessResponse(null, 'Inspection cancelled'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Inspection', inspection.id, { action: 'soft_delete', previousStatus }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /:id/certificate - Generate inspection certificate PDF
router.get('/:id/certificate', requireAuth, async (req, res, next) => {
  try {
    const inspection = await db.Inspection.findByPk(req.params.id, {
      include: [
        { model: db.Factory, as: 'factory' },
        { association: 'report' }
      ]
    });

    if (!inspection) throw new NotFoundError('Inspection not found');

    const pdfFile = await documentGenerator.generateInspectionCertificatePDF(inspection, inspection.report, inspection.factory);
    res.json(getSuccessResponse({ pdfFile }, 'Inspection certificate PDF generated'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
