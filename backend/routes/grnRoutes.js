/**
 * Goods Received Note (GRN) Management Routes
 * @module routes/grnRoutes
 * @description Endpoints for managing GRNs for purchase order receipt and inventory acceptance
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 * @requires ../services/auditService
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const webhookService = require('../services/webhookService');
const logger = require('../utils/logger.js');

/**
 * GET /api/grns
 * List all GRNs with pagination and filtering
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, poId } = req.query;
    const { offset } = getPagination(page, limit);
    const where = {};
    if (status) where.status = status;
    if (poId) where.poId = poId;

    const { count, rows } = await db.GoodsReceivedNote.findAndCountAll({
      where,
      include: [
        { model: db.PurchaseOrder, as: 'purchaseOrder', attributes: ['poNumber', 'total'] },
        { model: db.User, as: 'receivedByUser', attributes: ['firstName', 'lastName'] }
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

/**
 * GET /api/grns/:id
 * Get GRN details
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const grn = await db.GoodsReceivedNote.findByPk(req.params.id, {
      include: [
        { model: db.PurchaseOrder, as: 'purchaseOrder', include: [{ model: db.Factory, as: 'factory' }] },
        { model: db.User, as: 'receivedByUser', attributes: ['firstName', 'lastName', 'email'] }
      ]
    });

    if (!grn) throw new NotFoundError('GRN not found');
    res.json(getSuccessResponse(grn));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/grns
 * Create a new GRN when goods are received against a PO
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { poId, items, notes, warehouseLocation, inspectionStatus, inspectionNotes } = req.body;

    if (!poId) {
      throw new ValidationError('poId is required');
    }

    const po = await db.PurchaseOrder.findByPk(poId);
    if (!po) throw new NotFoundError('Purchase Order not found');

    const grn = await db.GoodsReceivedNote.create({
      id: uuidv4(),
      grnNumber: `GRN-${Date.now()}`,
      poId,
      receivedDate: new Date(),
      receivedBy: req.user.id,
      items: items || [],
      status: 'pending',
      notes: notes || null,
      warehouseLocation: warehouseLocation || null,
      inspectionStatus: inspectionStatus || 'pending',
      inspectionNotes: inspectionNotes || null
    });

    res.status(201).json(getSuccessResponse(grn, 'GRN created successfully'));

    // Fire-and-forget operations
    auditService.logAction(req.user.id, 'CREATE', 'GoodsReceivedNote', grn.id, { data: grn.toJSON() }, req.ip).catch(() => {});
    webhookService.triggerWebhook('grn.created', {
      grnId: grn.id,
      grnNumber: grn.grnNumber,
      poId: grn.poId,
      status: grn.status,
      createdAt: grn.createdAt
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/grns/:id
 * Update GRN details
 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { items, notes, warehouseLocation, inspectionStatus, inspectionNotes } = req.body;

    const grn = await db.GoodsReceivedNote.findByPk(req.params.id);
    if (!grn) throw new NotFoundError('GRN not found');

    const beforeSnapshot = grn.toJSON();

    await grn.update({
      items: items !== undefined ? items : grn.items,
      notes: notes !== undefined ? notes : grn.notes,
      warehouseLocation: warehouseLocation !== undefined ? warehouseLocation : grn.warehouseLocation,
      inspectionStatus: inspectionStatus !== undefined ? inspectionStatus : grn.inspectionStatus,
      inspectionNotes: inspectionNotes !== undefined ? inspectionNotes : grn.inspectionNotes
    });

    const updatedGrn = await db.GoodsReceivedNote.findByPk(grn.id);
    res.json(getSuccessResponse(updatedGrn, 'GRN updated'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'GoodsReceivedNote', grn.id, { before: beforeSnapshot, after: updatedGrn?.toJSON?.() || grn.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/grns/:id/accept
 * Accept received goods (updates inventory and marks GRN as accepted)
 */
router.post('/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const grn = await db.GoodsReceivedNote.findByPk(req.params.id, {
      include: [{ model: db.PurchaseOrder, as: 'purchaseOrder' }]
    });

    if (!grn) throw new NotFoundError('GRN not found');
    if (grn.status === 'accepted') {
      return res.status(400).json({ success: false, error: { message: 'GRN already accepted', statusCode: 400 } });
    }

    const beforeSnapshot = grn.toJSON();

    // Update inventory for each item in GRN
    if (grn.items && Array.isArray(grn.items)) {
      for (const item of grn.items) {
        try {
          const inventoryItem = await db.InventoryItem.findOne({
            where: { productId: item.productId }
          });

          if (inventoryItem) {
            const quantityReceived = item.quantityReceived || item.quantity || 0;
            await inventoryItem.increment('quantity', { by: quantityReceived });

            // Log inventory transaction
            await db.InventoryTransaction.create({
              id: uuidv4(),
              inventoryItemId: inventoryItem.id,
              type: 'in',
              quantity: quantityReceived,
              reference: grn.grnNumber,
              description: `Goods received from GRN ${grn.grnNumber}`,
              performedBy: req.user.id
            });
          }
        } catch (itemError) {
          logger.error(`Failed to update inventory for product ${item.productId}:`, itemError);
        }
      }
    }

    // Update GRN status
    await grn.update({
      status: 'accepted'
    });

    // Update PO status to received if not already
    if (grn.purchaseOrder && grn.purchaseOrder.status !== 'received' && grn.purchaseOrder.status !== 'completed') {
      await grn.purchaseOrder.update({ status: 'received' });
    }

    const updatedGrn = await db.GoodsReceivedNote.findByPk(grn.id);
    res.json(getSuccessResponse(updatedGrn, 'Goods received and inventory updated'));

    // Fire-and-forget operations
    auditService.logAction(req.user.id, 'UPDATE', 'GoodsReceivedNote', grn.id, { before: beforeSnapshot, after: updatedGrn?.toJSON?.() || grn.toJSON(), action: 'accepted' }, req.ip).catch(() => {});
    webhookService.triggerWebhook('grn.accepted', {
      grnId: grn.id,
      grnNumber: grn.grnNumber,
      poId: grn.poId,
      acceptedAt: new Date()
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/grns/:id/reject
 * Reject goods (creates return/claim)
 */
router.post('/:id/reject', requireAuth, async (req, res, next) => {
  try {
    const { reason, returnNotes } = req.body;

    const grn = await db.GoodsReceivedNote.findByPk(req.params.id, {
      include: [{ model: db.PurchaseOrder, as: 'purchaseOrder', include: [{ model: db.SalesOrder, as: 'salesOrder' }] }]
    });

    if (!grn) throw new NotFoundError('GRN not found');
    if (grn.status === 'rejected') {
      return res.status(400).json({ success: false, error: { message: 'GRN already rejected', statusCode: 400 } });
    }

    const beforeSnapshot = grn.toJSON();

    await grn.update({
      status: 'rejected',
      notes: returnNotes || reason || grn.notes
    });

    const updatedGrn = await db.GoodsReceivedNote.findByPk(grn.id);
    res.json(getSuccessResponse(updatedGrn, 'Goods rejected'));

    // Fire-and-forget operations
    auditService.logAction(req.user.id, 'UPDATE', 'GoodsReceivedNote', grn.id, { before: beforeSnapshot, after: updatedGrn?.toJSON?.() || grn.toJSON(), action: 'rejected', reason }, req.ip).catch(() => {});
    webhookService