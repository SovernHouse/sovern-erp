const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireAny } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse, generateDocumentNumber } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { Op } = require('sequelize');
const documentGenerator = require('../services/documentGenerator');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const webhookService = require('../services/webhookService');
const { validateTransition } = require('../utils/statusMachine');
const { validateFinancials } = require('../utils/validateFinancials');
const { validateTradeFields } = require('../utils/validateTradeFields');
const logger = require('../utils/logger.js');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, customerId } = req.query;
    const { offset } = getPagination(page, limit);
    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const { count, rows } = await db.SalesOrder.findAndCountAll({
      where,
      include: [
        { model: db.Customer, as: 'customer', attributes: ['companyName'] },
        { model: db.Factory, as: 'factory', attributes: ['companyName'] }
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
    const so = await db.SalesOrder.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.Factory, as: 'factory' },
        { association: 'shipments' },
        { association: 'invoices' }
      ]
    });

    if (!so) throw new NotFoundError('Sales Order not found');
    res.json(getSuccessResponse(so));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    const so = await db.SalesOrder.findByPk(req.params.id);

    if (!so) throw new NotFoundError('Sales Order not found');

    // FIX BUG 5: Validate status transition before allowing change
    validateTransition(so.status, status, 'sales_order');

    const beforeStatus = so.status;
    await so.update({ status });

    if (status === 'shipped') {
      await db.SalesOrderItem.update(
        { status: 'shipped' },
        { where: { salesOrderId: so.id } }
      );
    }

    res.json(getSuccessResponse(so, 'Status updated'));

    // Fire-and-forget: audit log, real-time notification, and webhooks
    auditService.logAction(req.user.id, 'UPDATE', 'SalesOrder', so.id, { statusChange: { before: beforeStatus, after: status } }, req.ip).catch(() => {});
    notificationService.emitOrderStatusChange(so.id, status, so.customerId, so.salesPersonId).catch(() => {});
    webhookService.triggerWebhook('order.statusChanged', {
      orderId: so.id,
      orderNumber: so.orderNumber,
      previousStatus: beforeStatus,
      newStatus: status,
      changedAt: new Date()
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// POST /bulk-status - Update status on multiple sales orders
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
        const so = await db.SalesOrder.findByPk(order.id);
        if (!so) {
          errors.push({ id: order.id, error: 'Order not found' });
          continue;
        }

        // Validate status transition
        validateTransition(so.status, order.status, 'sales_order');

        const beforeStatus = so.status;
        await so.update({ status: order.status });

        if (order.status === 'shipped') {
          await db.SalesOrderItem.update(
            { status: 'shipped' },
            { where: { salesOrderId: so.id } }
          );
        }

        updates.push({
          id: so.id,
          orderNumber: so.orderNumber,
          status: 'updated'
        });

        // Fire-and-forget: audit log and notifications
        auditService.logAction(req.user.id, 'BULK_UPDATE', 'SalesOrder', so.id, { statusChange: { before: beforeStatus, after: order.status } }, req.ip).catch(() => {});
        notificationService.emitOrderStatusChange(so.id, order.status, so.customerId, so.salesPersonId).catch(() => {});
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
    }, `${updates.length} orders updated successfully`));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/timeline', requireAuth, async (req, res, next) => {
  try {
    const so = await db.SalesOrder.findByPk(req.params.id);
    if (!so) throw new NotFoundError('Sales Order not found');

    const timeline = [];
    timeline.push({ date: so.createdAt, action: 'Order created', status: 'created' });
    timeline.push({ date: so.updatedAt, action: 'Last updated', status: so.status });

    if (so.estimatedDelivery) {
      timeline.push({ date: so.estimatedDelivery, action: 'Estimated delivery', status: 'estimated' });
    }

    if (so.actualDelivery) {
      timeline.push({ date: so.actualDelivery, action: 'Delivered', status: 'delivered' });
    }

    res.json(getSuccessResponse(timeline.sort((a, b) => new Date(a.date) - new Date(b.date))));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/documents', requireAuth, async (req, res, next) => {
  try {
    const documents = await db.ShippingDocument.findAll({
      where: { salesOrderId: req.params.id }
    });

    res.json(getSuccessResponse(documents));
  } catch (error) {
    next(error);
  }
});

// POST / - Create sales order directly
router.post('/', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    validateFinancials(req.body);
    validateTradeFields(req.body);
    const { customerId, factoryId, items, estimatedDelivery, shippingMethod, notes, discount, tax, currency } = req.body;

    // Validation
    if (!customerId) throw new ValidationError('customerId is required');
    if (!factoryId) throw new ValidationError('factoryId is required');
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    // Verify customer and factory exist
    const customer = await db.Customer.findByPk(customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const factory = await db.Factory.findByPk(factoryId);
    if (!factory) throw new NotFoundError('Factory not found');

    // Generate order number
    const orderNumber = generateDocumentNumber('SO');

    // FIX BUG 4: Check inventory availability before creating order items
    // Calculate totals and validate inventory
    let subtotal = 0;
    const validatedItems = [];
    const unavailableProducts = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || !item.unitPrice) {
        throw new ValidationError('Each item must have productId, quantity, and unitPrice');
      }

      const product = await db.Product.findByPk(item.productId);
      if (!product) throw new NotFoundError(`Product ${item.productId} not found`);

      // Check inventory availability - gracefully handle missing inventory tracking
      const inventoryItem = await db.InventoryItem.findOne({
        where: { productId: item.productId }
      });

      if (inventoryItem) {
        const availableQty = parseFloat(inventoryItem.quantity) - parseFloat(inventoryItem.reservedQty);
        if (availableQty < parseFloat(item.quantity)) {
          unavailableProducts.push({
            productId: item.productId,
            productName: product.name,
            requestedQty: item.quantity,
            availableQty: Math.max(0, availableQty)
          });
        }
      }
      // If no inventory tracking, allow the order (graceful handling)

      const itemTotal = item.quantity * item.unitPrice;
      subtotal += itemTotal;

      validatedItems.push({
        id: uuidv4(),
        productId: item.productId,
        description: item.description || product.name || 'Product',
        quantity: item.quantity,
        unit: item.unit || 'sqm',
        unitPrice: item.unitPrice,
        total: itemTotal,
        status: 'pending'
      });
    }

    // If any products have insufficient inventory, return 400 error with details
    if (unavailableProducts.length > 0) {
      await transaction.rollback();
      throw new ValidationError(
        `Insufficient inventory for ${unavailableProducts.length} product(s). Details: ${JSON.stringify(unavailableProducts)}`
      );
    }

    const discountAmount = discount || 0;
    const taxAmount = tax || 0;
    const total = subtotal - discountAmount + taxAmount;

    // Create sales order
    const so = await db.SalesOrder.create(
      {
        id: uuidv4(),
        orderNumber,
        customerId,
        factoryId,
        status: 'confirmed',
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        currency: currency || 'USD',
        paymentStatus: 'unpaid',
        estimatedDelivery: estimatedDelivery || null,
        shippingMethod: shippingMethod || null,
        notes: notes || null
      },
      { transaction }
    );

    // Create order items
    for (const item of validatedItems) {
      await db.SalesOrderItem.create({ ...item, salesOrderId: so.id }, { transaction });
    }

    await transaction.commit();

    // Fetch complete SO with items
    const completeSo = await db.SalesOrder.findByPk(so.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.Factory, as: 'factory' }
      ]
    });

    res.status(201).json(getSuccessResponse(completeSo, 'Sales Order created successfully'));

    // Fire-and-forget email, audit log, real-time notification, and webhooks
    emailService.sendOrderConfirmationEmail(completeSo.customer, completeSo).catch(err => logger.error('[EMAIL] Error:', err.message));
    auditService.logAction(req.user.id, 'CREATE', 'SalesOrder', so.id, { data: completeSo?.toJSON?.() || so.toJSON() }, req.ip).catch(() => {});
    notificationService.emitOrderStatusChange(so.id, 'confirmed', so.customerId, so.salesPersonId).catch(() => {});
    webhookService.triggerWebhook('order.created', {
      orderId: so.id,
      orderNumber: so.orderNumber,
      customerId: so.customerId,
      status: so.status,
      total: so.total,
      currency: so.currency,
      createdAt: so.createdAt,
      itemsCount: validatedItems.length
    }).catch(() => {});
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// POST /create-from-quotation - Create sales order from accepted quotation
router.post('/create-from-quotation', requireAuth, async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { quotationId, factoryId, estimatedDelivery, shippingMethod, notes } = req.body;

    // Validation
    if (!quotationId) throw new ValidationError('quotationId is required');
    if (!factoryId) throw new ValidationError('factoryId is required');

    // Verify quotation exists
    const quotation = await db.Quotation.findByPk(quotationId, {
      include: [{ association: 'items' }]
    });

    if (!quotation) throw new NotFoundError('Quotation not found');
    if (quotation.status !== 'accepted') {
      throw new ValidationError('Quotation status must be "accepted" to create sales order');
    }

    if (!quotation.items || quotation.items.length === 0) {
      throw new ValidationError('Quotation has no items');
    }

    // Verify factory exists
    const factory = await db.Factory.findByPk(factoryId);
    if (!factory) throw new NotFoundError('Factory not found');

    // Generate order number
    const orderNumber = generateDocumentNumber('SO');

    // Copy quotation items to sales order items
    const salesOrderItems = quotation.items.map(qItem => ({
      id: uuidv4(),
      productId: qItem.productId,
      description: qItem.description || 'Product',
      quantity: qItem.quantity,
      unit: qItem.unit || 'sqm',
      unitPrice: qItem.unitPrice,
      total: qItem.total,
      status: 'pending'
    }));

    // Create sales order with quotation totals
    const so = await db.SalesOrder.create(
      {
        id: uuidv4(),
        orderNumber,
        customerId: quotation.customerId,
        factoryId,
        status: 'confirmed',
        subtotal: quotation.subtotal,
        discount: quotation.discount || 0,
        tax: quotation.tax || 0,
        total: quotation.total,
        currency: quotation.currency || 'USD',
        paymentStatus: 'unpaid',
        estimatedDelivery: estimatedDelivery || null,
        shippingMethod: shippingMethod || null,
        notes: notes || null
      },
      { transaction }
    );

    // Create sales order items
    for (const item of salesOrderItems) {
      await db.SalesOrderItem.create({ ...item, salesOrderId: so.id }, { transaction });
    }

    await transaction.commit();

    // Fetch complete SO with items
    const completeSo = await db.SalesOrder.findByPk(so.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.Factory, as: 'factory' }
      ]
    });

    res.status(201).json(getSuccessResponse(completeSo, 'Sales Order created from quotation successfully'));

    // Fire-and-forget email and audit log
    emailService.sendOrderConfirmationEmail(completeSo.customer, completeSo).catch(err => logger.error('[EMAIL] Error:', err.message));
    auditService.logAction(req.user.id, 'CREATE', 'SalesOrder', so.id, { data: completeSo?.toJSON?.() || so.toJSON(), quotationId }, req.ip).catch(() => {});
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// PUT /:id - Update sales order
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const so = await db.SalesOrder.findByPk(req.params.id);
    if (!so) throw new NotFoundError('Sales Order not found');

    // Prevent editing of shipped, delivered, or completed orders
    const lockedStatuses = ['shipped', 'in_transit', 'delivered', 'completed'];
    if (lockedStatuses.includes(so.status)) {
      throw new ValidationError(`Cannot edit ${so.status} orders`);
    }

    const beforeSnapshot = so.toJSON();
    const { customerId, factoryId, estimatedDelivery, shippingMethod, notes, discount, tax, currency } = req.body;

    // Verify references if provided
    if (customerId) {
      const customer = await db.Customer.findByPk(customerId);
      if (!customer) throw new NotFoundError('Customer not found');
    }

    if (factoryId) {
      const factory = await db.Factory.findByPk(factoryId);
      if (!factory) throw new NotFoundError('Factory not found');
    }

    // Update fields
    const updateData = {};
    if (customerId !== undefined) updateData.customerId = customerId;
    if (factoryId !== undefined) updateData.factoryId = factoryId;
    if (estimatedDelivery !== undefined) updateData.estimatedDelivery = estimatedDelivery;
    if (shippingMethod !== undefined) updateData.shippingMethod = shippingMethod;
    if (notes !== undefined) updateData.notes = notes;
    if (discount !== undefined) updateData.discount = discount;
    if (tax !== undefined) updateData.tax = tax;
    if (currency !== undefined) updateData.currency = currency;

    // Recalculate total if discount or tax changed
    if (discount !== undefined || tax !== undefined) {
      updateData.total = (updateData.subtotal || so.subtotal) - (updateData.discount || so.discount) + (updateData.tax || so.tax);
    }

    await so.update(updateData);

    const updatedSo = await db.SalesOrder.findByPk(so.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.Factory, as: 'factory' }
      ]
    });

    res.json(getSuccessResponse(updatedSo, 'Sales Order updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'SalesOrder', so.id, { before: beforeSnapshot, after: updatedSo?.toJSON?.() || so.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// DELETE /:id - Cancel/soft-delete sales order
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const so = await db.SalesOrder.findByPk(req.params.id);
    if (!so) throw new NotFoundError('Sales Order not found');

    // Soft delete by updating status to cancelled
    await so.update({ status: 'cancelled' });

    res.json(getSuccessResponse(so, 'Sales Order cancelled successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'SalesOrder', so.id, { action: 'soft_delete', previousStatus: so.status }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /:id/pdf - Generate and return sales order PDF
router.get('/:id/pdf', requireAuth, async (req, res, next) => {
  try {
    const so = await db.SalesOrder.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.Factory, as: 'factory' }
      ]
    });

    if (!so) throw new NotFoundError('Sales Order not found');

    // Generate PDF using document generator
    const pdfFile = await documentGenerator.generateSalesOrderPDF(so, so.items, so.customer, so.factory);

    res.json(getSuccessResponse({ pdfFile }, 'PDF generated'));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /:id/create-packing-list
 * Auto-create a draft PackingList from a Sales Order's line items.
 *
 * Weights and dimensions default to 0 — the user fills them in after creation.
 * Returns the new PackingList so the frontend can navigate directly to it.
 *
 * Guards:
 *   - SO must exist and must not be cancelled
 *   - A PackingList for this SO must not already exist in draft/confirmed state
 */
router.post('/:id/create-packing-list', requireAuth, async (req, res, next) => {
  const t = await db.sequelize.transaction();
  try {
    const so = await db.SalesOrder.findByPk(req.params.id, {
      include: [{ association: 'items', include: [{ model: db.Product, as: 'product' }] }],
      transaction: t,
    });

    if (!so) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Sales Order not found' });
    }

    if (so.status === 'cancelled') {
      await t.rollback();
      return res.status(409).json({ success: false, message: 'Cannot create a Packing List for a cancelled Sales Order' });
    }

    // Guard: prevent duplicate packing lists per order
    const existing = await db.PackingList.findOne({
      where: { salesOrderId: so.id, deletedAt: null },
      transaction: t,
    });
    if (existing) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: 'A Packing List already exists for this Sales Order',
        data: { packingListId: existing.id },
      });
    }

    const items = so.items || [];

    const pl = await db.PackingList.create({
      id: uuidv4(),
      packingListNumber: generateDocumentNumber('PL'),
      salesOrderId: so.id,
      status: 'draft',
      totalPackages: items.length,
      totalGrossWeight: 0,
      totalNetWeight: 0,
      totalVolume: 0,
    }, { transaction: t });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await db.PackingListItem.create({
        id: uuidv4(),
        packingListId: pl.id,
        productId: item.productId || null,
        description: item.product?.name || item.description || '',
        quantity: item.quantity,
        unit: item.unit || 'pcs',
        packageNumber: i + 1,
        grossWeight: 0,
        netWeight: 0,
        dimensions: {},
        marks: null,
      }, { transaction: t });
    }

    await t.commit();

    // Return the full packing list with items
    const completePL = await db.PackingList.findByPk(pl.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.SalesOrder, as: 'salesOrder', attributes: ['orderNumber'] },
      ],
    });

    res.status(201).json(getSuccessResponse(completePL, 'Packing List created from Sales Order'));
  } catch (error) {
    await t.rollback();
    next(error);
  }
});

module.exports = router;
