/**
 * Purchase Order Management Routes
 * @module routes/purchaseOrderRoutes
 * @description Endpoints for managing purchase orders including creation, status updates, and supplier interactions
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
const { requireAuth, requireAny } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse, generateDocumentNumber } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const documentGenerator = require('../services/documentGenerator');
const { Op } = require('sequelize');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const webhookService = require('../services/webhookService');
const { validateTransition } = require('../utils/statusMachine');
const logger = require('../utils/logger.js');

/**
 * List all purchase orders with pagination and filtering
 * @route GET /api/purchase-orders
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @param {string} status - Filter by order status
 * @param {string} factoryId - Filter by factory ID
 * @returns {Object} Paginated list of purchase orders
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, factoryId } = req.query;
    const { offset } = getPagination(page, limit);
    const where = {};
    if (status) where.status = status;
    if (factoryId) where.factoryId = factoryId;

    const { count, rows } = await db.PurchaseOrder.findAndCountAll({
      where,
      include: [{ model: db.Factory, as: 'factory', attributes: ['companyName'] }],
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { factoryId, items, expectedDelivery, notes, currency = 'USD' } = req.body;

    if (!factoryId) {
      throw new ValidationError('Factory ID is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    const factory = await db.Factory.findByPk(factoryId, { transaction });
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }

    const poNumber = generateDocumentNumber('PO');

    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || !item.unitPrice) {
        throw new ValidationError('Each item must have productId, quantity, and unitPrice');
      }

      const product = await db.Product.findByPk(item.productId, { transaction });
      if (!product) {
        throw new NotFoundError(`Product ${item.productId} not found`);
      }

      const itemTotal = item.quantity * item.unitPrice;
      subtotal += itemTotal;

      validatedItems.push({
        productId: item.productId,
        description: item.description || product.name || 'Product',
        quantity: item.quantity,
        unit: item.unit || 'sqm',
        unitPrice: item.unitPrice,
        total: itemTotal,
        status: 'pending'
      });
    }

    const total = subtotal;

    const po = await db.PurchaseOrder.create(
      {
        id: uuidv4(),
        poNumber,
        factoryId,
        status: 'draft',
        subtotal,
        total,
        currency,
        expectedDelivery: expectedDelivery || null,
        notes: notes || null
      },
      { transaction }
    );

    for (const item of validatedItems) {
      await db.PurchaseOrderItem.create(
        { id: uuidv4(), purchaseOrderId: po.id, ...item },
        { transaction }
      );
    }

    await transaction.commit();

    const createdPO = await db.PurchaseOrder.findByPk(po.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Factory, as: 'factory' }
      ]
    });

    res.status(201).json(getSuccessResponse(createdPO, 'Purchase Order created successfully'));

    // Fire-and-forget audit log, real-time notification, and webhooks
    auditService.logAction(req.user.id, 'CREATE', 'PurchaseOrder', po.id, { data: createdPO?.toJSON?.() || po.toJSON() }, req.ip).catch(() => {});
    if (createdPO?.factory?.id) {
      const factoryUser = await db.User.findOne({ where: { factoryId: factoryId }, attributes: ['id'] }).catch(() => null);
      if (factoryUser) {
        notificationService.emitPurchaseOrderUpdate(po.id, 'draft', factoryUser.id).catch(() => {});
      }
    }
    // Note: PO webhooks can be extended by adding custom events
    // webhookService.triggerWebhook('purchase_order.created', {...}).catch(() => {});
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.post('/create-from-sales-order', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { salesOrderId, factoryId, expectedDelivery, notes } = req.body;

    if (!salesOrderId) {
      throw new ValidationError('Sales Order ID is required');
    }

    if (!factoryId) {
      throw new ValidationError('Factory ID is required');
    }

    const salesOrder = await db.SalesOrder.findByPk(salesOrderId, {
      include: [{ association: 'items', include: [{ model: db.Product, as: 'product' }] }],
      transaction
    });

    if (!salesOrder) {
      throw new NotFoundError('Sales Order not found');
    }

    if (!salesOrder.items || salesOrder.items.length === 0) {
      throw new ValidationError('Sales Order has no items to copy');
    }

    const factory = await db.Factory.findByPk(factoryId, { transaction });
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }

    const poNumber = generateDocumentNumber('PO');

    let subtotal = 0;
    const validatedItems = [];

    for (const soItem of salesOrder.items) {
      const itemTotal = parseFloat(soItem.quantity) * parseFloat(soItem.unitPrice);
      subtotal += itemTotal;

      validatedItems.push({
        productId: soItem.productId,
        description: soItem.product ? soItem.product.name : 'Product',
        quantity: soItem.quantity,
        unit: soItem.unit || 'sqm',
        unitPrice: soItem.unitPrice,
        total: itemTotal,
        status: 'pending'
      });
    }

    const total = subtotal;

    const po = await db.PurchaseOrder.create(
      {
        id: uuidv4(),
        poNumber,
        salesOrderId,
        factoryId,
        status: 'draft',
        subtotal,
        total,
        currency: salesOrder.currency || 'USD',
        expectedDelivery: expectedDelivery || salesOrder.estimatedDelivery || null,
        notes: notes || salesOrder.notes || null
      },
      { transaction }
    );

    for (const item of validatedItems) {
      await db.PurchaseOrderItem.create(
        { id: uuidv4(), purchaseOrderId: po.id, ...item },
        { transaction }
      );
    }

    await transaction.commit();

    const createdPO = await db.PurchaseOrder.findByPk(po.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Factory, as: 'factory' },
        { model: db.SalesOrder, as: 'salesOrder' }
      ]
    });

    res.status(201).json(getSuccessResponse(createdPO, 'Purchase Order created from Sales Order'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'PurchaseOrder', po.id, { data: createdPO?.toJSON?.() || po.toJSON(), salesOrderId }, req.ip).catch(() => {});
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const po = await db.PurchaseOrder.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Factory, as: 'factory' },
        { model: db.SalesOrder, as: 'salesOrder' }
      ]
    });

    if (!po) throw new NotFoundError('Purchase Order not found');
    res.json(getSuccessResponse(po));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { factoryId, items, expectedDelivery, notes, currency } = req.body;

    const po = await db.PurchaseOrder.findByPk(req.params.id, {
      include: [{ association: 'items' }],
      transaction
    });

    if (!po) {
      throw new NotFoundError('Purchase Order not found');
    }

    const beforeSnapshot = po.toJSON();

    if (po.status !== 'draft') {
      throw new ValidationError('Only draft Purchase Orders can be updated');
    }

    if (factoryId) {
      const factory = await db.Factory.findByPk(factoryId, { transaction });
      if (!factory) {
        throw new NotFoundError('Factory not found');
      }
    }

    if (items && Array.isArray(items) && items.length > 0) {
      await db.PurchaseOrderItem.destroy({
        where: { purchaseOrderId: po.id },
        transaction
      });

      let subtotal = 0;
      const createdItems = [];

      for (const item of items) {
        if (!item.productId || !item.quantity || !item.unitPrice) {
          throw new ValidationError('Each item must have productId, quantity, and unitPrice');
        }

        const product = await db.Product.findByPk(item.productId, { transaction });
        if (!product) {
          throw new NotFoundError(`Product ${item.productId} not found`);
        }

        const itemTotal = item.quantity * item.unitPrice;
        subtotal += itemTotal;

        const poItem = await db.PurchaseOrderItem.create(
          {
            id: uuidv4(),
            purchaseOrderId: po.id,
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit || product.unit || 'pieces',
            unitPrice: item.unitPrice,
            total: itemTotal,
            status: 'pending',
            notes: item.notes || null
          },
          { transaction }
        );

        createdItems.push(poItem);
      }

      await po.update(
        {
          factoryId: factoryId || po.factoryId,
          subtotal,
          total: subtotal,
          currency: currency || po.currency,
          expectedDelivery: expectedDelivery !== undefined ? expectedDelivery : po.expectedDelivery,
          notes: notes !== undefined ? notes : po.notes
        },
        { transaction }
      );
    } else {
      await po.update(
        {
          factoryId: factoryId || po.factoryId,
          currency: currency || po.currency,
          expectedDelivery: expectedDelivery !== undefined ? expectedDelivery : po.expectedDelivery,
          notes: notes !== undefined ? notes : po.notes
        },
        { transaction }
      );
    }

    await transaction.commit();

    const updatedPO = await db.PurchaseOrder.findByPk(po.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Factory, as: 'factory' }
      ]
    });

    res.json(getSuccessResponse(updatedPO, 'Purchase Order updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'PurchaseOrder', po.id, { before: beforeSnapshot, after: updatedPO?.toJSON?.() || po.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const po = await db.PurchaseOrder.findByPk(req.params.id);

    if (!po) {
      throw new NotFoundError('Purchase Order not found');
    }

    const cancelableStatuses = ['draft', 'sent', 'confirmed'];
    if (!cancelableStatuses.includes(po.status)) {
      throw new ValidationError(`Purchase Order with status '${po.status}' cannot be cancelled`);
    }

    const previousStatus = po.status;
    await po.update({ status: 'cancelled' });

    await db.PurchaseOrderItem.update(
      { status: 'cancelled' },
      { where: { purchaseOrderId: po.id } }
    );

    res.json(getSuccessResponse(po, 'Purchase Order cancelled successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'PurchaseOrder', po.id, { action: 'soft_delete', previousStatus }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    const po = await db.PurchaseOrder.findByPk(req.params.id);

    if (!po) throw new NotFoundError('Purchase Order not found');

    // FIX BUG 5: Validate status transition before allowing change
    validateTransition(po.status, status, 'purchase_order');

    await po.update({ status });

    if (status === 'shipped') {
      await db.PurchaseOrderItem.update(
        { status: 'shipped' },
        { where: { purchaseOrderId: po.id } }
      );
    }

    res.json(getSuccessResponse(po, 'Status updated'));

    // Fire-and-forget real-time notification
    const factoryUser = await db.User.findOne({ where: { factoryId: po.factoryId }, attributes: ['id'] }).catch(() => null);
    if (factoryUser) {
      notificationService.emitPurchaseOrderUpdate(po.id, status, factoryUser.id).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
});

// POST /bulk-status - Update status on multiple purchase orders
router.post('/bulk-status', requireAuth, async (req, res, next) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      throw new ValidationError('Orders array is required and must not be empty');
    }

    const updates = [];
    const errors = [];

    for (const order of orders) {
      if (!order.id || !order.status) {
        throw new ValidationError('Each order must have id and status');
      }

      try {
        const po = await db.PurchaseOrder.findByPk(order.id);
        if (!po) {
          errors.push({ id: order.id, error: 'Purchase Order not found' });
          continue;
        }

        // Validate status transition
        validateTransition(po.status, order.status, 'purchase_order');

        const beforeStatus = po.status;
        await po.update({ status: order.status });

        if (order.status === 'shipped') {
          await db.PurchaseOrderItem.update(
            { status: 'shipped' },
            { where: { purchaseOrderId: po.id } }
          );
        }

        updates.push({
          id: po.id,
          poNumber: po.poNumber,
          status: 'updated'
        });

        // Fire-and-forget: audit log and notifications
        auditService.logAction(req.user.id, 'BULK_UPDATE', 'PurchaseOrder', po.id, { statusChange: { before: beforeStatus, after: order.status } }, req.ip).catch(() => {});
        const factoryUser = await db.User.findOne({ where: { factoryId: po.factoryId }, attributes: ['id'] }).catch(() => null);
        if (factoryUser) {
          notificationService.emitPurchaseOrderUpdate(po.id, order.status, factoryUser.id).catch(() => {});
        }
      } catch (err) {
        errors.push({ id: order.id, error: err.message });
      }
    }

    res.json(getSuccessResponse({
      updated: updates,
      errors: errors.length > 0 ? errors : null,
      totalProcessed: orders.length,
      successCount: updates.length,
      errorCount: errors.length
    }, `${updates.length} purchase orders updated successfully`));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/confirm', requireAuth, async (req, res, next) => {
  try {
    const po = await db.PurchaseOrder.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Factory, as: 'factory' }
      ]
    });

    if (!po) {
      throw new NotFoundError('Purchase Order not found');
    }

    if (po.status !== 'sent') {
      throw new ValidationError('Only sent Purchase Orders can be confirmed');
    }

    const beforeStatus = po.status;
    await po.update({ status: 'confirmed' });

    await db.PurchaseOrderItem.update(
      { status: 'confirmed' },
      { where: { purchaseOrderId: po.id } }
    );

    const updatedPO = await db.PurchaseOrder.findByPk(po.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Factory, as: 'factory' }
      ]
    });

    res.json(getSuccessResponse(updatedPO, 'Purchase Order confirmed by factory'));

    // Fire-and-forget audit log and real-time notification
    auditService.logAction(req.user.id, 'UPDATE', 'PurchaseOrder', po.id, { statusChange: { before: beforeStatus, after: 'confirmed' } }, req.ip).catch(() => {});
    const factoryUser = await db.User.findOne({ where: { factoryId: po.factoryId }, attributes: ['id'] }).catch(() => null);
    if (factoryUser) {
      notificationService.emitPurchaseOrderUpdate(po.id, 'confirmed', factoryUser.id).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
});

router.post('/:id/send', requireAuth, async (req, res, next) => {
  try {
    const po = await db.PurchaseOrder.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Factory, as: 'factory' }
      ]
    });

    if (!po) throw new NotFoundError('Purchase Order not found');

    const pdfFile = await documentGenerator.generatePurchaseOrderPDF(po, po.items, po.factory);
    await po.update({ status: 'sent' });

    res.json(getSuccessResponse({ pdfFile }, 'PO sent successfully'));

    // Fire-and-forget email
    emailService.sendPurchaseOrderEmail(po.factory, po).catch(err => logger.error('[EMAIL] Error:', err.message));
  } catch (error) {
    next(error);
  }
});

router