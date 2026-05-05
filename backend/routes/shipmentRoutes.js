/**
 * Shipment Management Routes
 * @module routes/shipmentRoutes
 * @description Endpoints for managing shipments including tracking, status updates, and logistics coordination
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
const { requireAuth } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const documentGenerator = require('../services/documentGenerator');
const notificationService = require('../services/notificationService');
const webhookService = require('../services/webhookService');
const logger = require('../utils/logger.js');

/**
 * List all shipments with pagination and filtering
 * @route GET /api/shipments
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @param {string} status - Filter by shipment status
 * @param {string} salesOrderId - Filter by sales order ID
 * @returns {Object} Paginated list of shipments
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, salesOrderId } = req.query;
    const { offset } = getPagination(page, limit);
    const where = {};
    if (status) where.status = status;
    if (salesOrderId) where.salesOrderId = salesOrderId;

    const { count, rows } = await db.Shipment.findAndCountAll({
      where,
      include: [
        { model: db.SalesOrder, as: 'salesOrder', attributes: ['orderNumber'] },
        { association: 'trackingEvents', attributes: ['status', 'location', 'timestamp'] }
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
    const shipment = await db.Shipment.findByPk(req.params.id, {
      include: [
        { model: db.SalesOrder, as: 'salesOrder' },
        { association: 'trackingEvents', include: [{ model: db.User, as: 'updatedByUser', attributes: ['firstName', 'lastName'] }] }
      ]
    });

    if (!shipment) throw new NotFoundError('Shipment not found');
    res.json(getSuccessResponse(shipment));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { salesOrderId, carrier, vesselName, containerNumber, containerType, portOfLoading, portOfDischarge } = req.body;

    const so = await db.SalesOrder.findByPk(salesOrderId);
    if (!so) throw new NotFoundError('Sales Order not found');

    const shipment = await db.Shipment.create({
      id: uuidv4(),
      salesOrderId,
      shipmentNumber: `SHP-${Date.now()}`,
      carrier,
      vesselName,
      containerNumber,
      containerType,
      portOfLoading,
      portOfDischarge,
      status: 'booked'
    });

    await db.ShipmentTracking.create({
      id: uuidv4(),
      shipmentId: shipment.id,
      status: 'booked',
      description: 'Shipment created and booked'
    });

    res.status(201).json(getSuccessResponse(shipment, 'Shipment created'));

    // Fire-and-forget email, audit log, real-time notification, and webhooks
    emailService.sendShipmentNotificationEmail(so.customer, shipment).catch(err => logger.error('[EMAIL] Error:', err.message));
    auditService.logAction(req.user.id, 'CREATE', 'Shipment', shipment.id, { data: shipment.toJSON() }, req.ip).catch(() => {});
    notificationService.emitShipmentUpdate(shipment.id, shipment.status, { carrier: shipment.carrier, containerNumber: shipment.containerNumber }, so.customerId).catch(() => {});
    webhookService.triggerWebhook('shipment.created', {
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      salesOrderId: shipment.salesOrderId,
      carrier: shipment.carrier,
      containerNumber: shipment.containerNumber,
      status: shipment.status,
      createdAt: shipment.createdAt
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

router.post('/:id/tracking', requireAuth, async (req, res, next) => {
  try {
    const { status, location, description } = req.body;

    const shipment = await db.Shipment.findByPk(req.params.id);
    if (!shipment) throw new NotFoundError('Shipment not found');

    await shipment.update({ status, currentLocation: location });

    const tracking = await db.ShipmentTracking.create({
      id: uuidv4(),
      shipmentId: shipment.id,
      status,
      location,
      description,
      updatedBy: req.user.id
    });

    res.status(201).json(getSuccessResponse(tracking, 'Tracking event added'));

    // Fire-and-forget email, real-time notification, and webhooks
    const fullShipment = await db.Shipment.findByPk(req.params.id, {
      include: [{ model: db.SalesOrder, as: 'salesOrder', include: [{ model: db.Customer, as: 'customer' }] }]
    });
    if (fullShipment && fullShipment.salesOrder && fullShipment.salesOrder.customer) {
      emailService.sendShipmentUpdateEmail(fullShipment.salesOrder.customer, fullShipment, tracking).catch(err => logger.error('[EMAIL] Error:', err.message));
      notificationService.emitShipmentUpdate(shipment.id, status, { location, description }, fullShipment.salesOrder.customerId).catch(() => {});
      webhookService.triggerWebhook('shipment.updated', {
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        status,
        currentLocation: location,
        description,
        updatedAt: tracking.timestamp
      }).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
});

router.get('/:id/tracking-history', requireAuth, async (req, res, next) => {
  try {
    const trackingEvents = await db.ShipmentTracking.findAll({
      where: { shipmentId: req.params.id },
      include: [{ model: db.User, as: 'updatedByUser', attributes: ['firstName', 'lastName'] }],
      order: [['timestamp', 'ASC']]
    });

    res.json(getSuccessResponse(trackingEvents));
  } catch (error) {
    next(error);
  }
});

// PUT /:id - Update shipment details
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const shipment = await db.Shipment.findByPk(req.params.id);
    if (!shipment) throw new NotFoundError('Shipment not found');

    const beforeSnapshot = shipment.toJSON();

    const { carrier, vesselName, containerNumber, containerType, portOfLoading, portOfDischarge, etd, eta, notes } = req.body;

    await shipment.update({
      carrier: carrier || shipment.carrier,
      vesselName: vesselName !== undefined ? vesselName : shipment.vesselName,
      containerNumber: containerNumber !== undefined ? containerNumber : shipment.containerNumber,
      containerType: containerType !== undefined ? containerType : shipment.containerType,
      portOfLoading: portOfLoading !== undefined ? portOfLoading : shipment.portOfLoading,
      portOfDischarge: portOfDischarge !== undefined ? portOfDischarge : shipment.portOfDischarge,
      etd: etd !== undefined ? (etd ? new Date(etd) : null) : shipment.etd,
      eta: eta !== undefined ? (eta ? new Date(eta) : null) : shipment.eta,
      notes: notes !== undefined ? notes : shipment.notes
    });

    const updatedShipment = await db.Shipment.findByPk(shipment.id);

    res.json(getSuccessResponse(updatedShipment, 'Shipment updated'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Shipment', shipment.id, { before: beforeSnapshot, after: updatedShipment?.toJSON?.() || shipment.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /:id/packing-lists - Get packing lists for this shipment's sales order
router.get('/:id/packing-lists', requireAuth, async (req, res, next) => {
  try {
    const shipment = await db.Shipment.findByPk(req.params.id);
    if (!shipment) throw new NotFoundError('Shipment not found');

    const packingLists = await db.PackingList.findAll({
      where: { salesOrderId: shipment.salesOrderId },
      include: [{ association: 'items', include: [{ model: db.Product, as: 'product', attributes: ['name', 'sku'] }] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(packingLists));
  } catch (error) {
    next(error);
  }
});

// GET /:id/documents - Get shipping documents for this shipment's sales order
router.get('/:id/documents', requireAuth, async (req, res, next) => {
  try {
    const shipment = await db.Shipment.findByPk(req.params.id);
    if (!shipment) throw new NotFoundError('Shipment not found');

    const documents = await db.ShippingDocument.findAll({
      where: { salesOrderId: shipment.salesOrderId },
      include: [{ model: db.User, as: 'uploader', attributes: ['firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(documents));
  } catch (error) {
    next(error);
  }
});

// DELETE /:id - Cancel shipment
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const shipment = await db.Shipment.findByPk(req.params.id);
    if (!shipment) throw new NotFoundError('Shipment not found');

    if (['delivered'].includes(shipment.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel a delivered shipment' });
    }

    const previousStatus = shipment.status;
    await shipment.update({ status: 'cancelled' });

    await db.ShipmentTracking.create({
      id: uuidv4(),
      shipmentId: shipment.id,
      status: 'cancelled',
      description: 'Shipment cancelled',
      updatedBy: req.user.id
    });

    res.json(getSuccessResponse(null, 'Shipment cancelled'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Shipment', shipment.id, { action: 'soft_delete', previousStatus }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PATCH /:id/deliver - Mark shipment as delivered with delivery details
router.patch('/:id/deliver', requireAuth, async (req, res, next) => {
  try {
    const { actualDeliveryDate, deliveryNotes, proofOfDeliveryReference } = req.body;

    const shipment = await db.Shipment.findByPk(req.params.id);
    if (!shipment) throw new NotFoundError('Shipment not found');

    const beforeSnapshot = shipment.toJSON();

    await shipment.update({
      status: 'delivered',
      actualDeliveryDate: actualDeliveryDate ? new Date(actualDeliveryDate) : new Date(),
      deliveryNotes: deliveryNotes || shipment.deliveryNotes,
      proofOfDeliveryReference: proofOfDeliveryReference || shipment.proofOfDeliveryReference,
      actualArrival: actualDeliveryDate ? new Date(actualDeliveryDate) : new Date()
    });

    await db.ShipmentTracking.create({
      id: uuidv4(),
      shipmentId: shipment.id,
      status: 'delivered',
      description: 'Shipment delivered',
      updatedBy: req.user.id
    });

    const updatedShipment = await db.Shipment.findByPk(shipment.id);
    res.json(getSuccessResponse(updatedShipment, 'Shipment marked as delivered'));

    // Fire-and-forget operations
    const fullShipment = await db.Shipment.findByPk(req.params.id, {
      include: [{ model: db.SalesOrder, as: 'salesOrder', include: [{ model: db.Customer, as: 'customer' }] }]
    });
    if (fullShipment && fullShipment.salesOrder && fullShipment.salesOrder.customer) {
      emailService.sendShipmentNotificationEmail(fullShipment.salesOrder.customer, fullShipment).catch(err => logger.error('[EMAIL] Error:', err.message));
      notificationService.emitShipmentUpdate(shipment.id, 'delivered', { deliveryDate: actualDeliveryDate }, fullShipment.salesOrder.customerId).catch(() => {});
      webhookService.triggerWebhook('shipment.delivered', {
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        actualDeliveryDate: actualDeliveryDate,
        proofOfDeliveryReference,
        deliveredAt: new Date()
      }).catch(() => {});
    }
    auditService.logAction(req.user.id, 'UPDATE', 'Shipment', shipment.id, { before: beforeSnapshot, after: updatedShipment?.toJSON?.() || shipment.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PATCH /:id/update-eta - Update estimated delivery date
router.patch('/:id/update-eta', requireAuth, async (req, res, next) => {
  try {
    const { eta } = req.body;

    if (!eta) {
      return res.status(400).json({ success: false, error: { message: 'eta is required', statusCode: 400 } });
    }

    const shipment = await db.Shipment.findByPk(req.params.id);
    if (!shipment) throw new NotFoundError('Shipment not found');

    const beforeSnapshot = shipment.toJSON();
    const previousEta = shipment.eta;

    await shipment.update({
      eta: new Date(eta)
    });

    await db.ShipmentTracking.create({
      id: uuidv4(),
      shipmentId: shipment.id,
      status: shipment.status,
      description: `ETA updated from ${previousEta} to ${eta}`,
      updatedBy: req.user.id
    });

    const updatedShipment = await db.Shipment.findByPk(shipment.id);
    res.json(getSuccessResponse(updatedShipment, 'Estimated delivery date updated'));

    // Fire-and-forget operations
    const fullShipment = await db.Shipment.findByPk(req.params.id, {
      include: [{ model: db.SalesOrder, as: 'salesOrder', include: [{ model: db.Customer, as: 'customer' }] }]
    });
    if (fullShipment && fullShipment.salesOrder && fullShipment.salesOrder.customer) {
      notificationService.emitShipmentUpdate(shipment.id, 'eta_updated', { newEta: eta, previousEta }, fullShipment.salesOrder.customerId).catch(() => {});
      webhookService.triggerWebhook('shipment.eta_updated', {
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        previousEta,
        newEta: eta,
        updatedAt: new Date()
      }).catch(() => {});
    }
    auditService.logAction(req.user.id, 'UPDATE', 'Shipment', shipment.id, { before: beforeSnapshot, after: updatedShipment?.toJSON?.() || shipment.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /:id/pdf - Generate shipment document PDF
router.get('/:id/pdf', requireAuth, async (req, res, next) => {
  try {
    const shipment = await db.Shipment.findByPk(req.params.id, {
      include: [
        { model: db.SalesOrder, as: 'salesOrder', include: [{ model: db.Customer, as: 'customer' }] }
      ]
    });

    if (!shipment) throw new NotFoundError('Shipment not fou