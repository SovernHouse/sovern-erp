const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const db = require('../models');
const { requireAuth } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const { uploadSingle } = require('../middleware/upload');

// Middleware to find factory for current user
const findFactoryForUser = async (req, res, next) => {
  try {
    // Find factory associated with this user
    const factory = await db.Factory.findOne({
      where: {
        email: req.user.email
      }
    });

    if (!factory) {
      throw new NotFoundError('No factory associated with your account');
    }

    req.factory = factory;
    next();
  } catch (error) {
    next(error);
  }
};

// Apply factory middleware to all routes
router.use(requireAuth, findFactoryForUser);

// GET /profile - Get factory profile for current user's factory
router.get('/profile', async (req, res, next) => {
  try {
    const factory = await db.Factory.findByPk(req.factory.id);
    res.json(getSuccessResponse(factory, 'Factory profile retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// PUT /profile - Update factory profile
router.put('/profile', async (req, res, next) => {
  try {
    const { companyName, contactPerson, phone, address, city, country, paymentTerms, leadTimeDays, notes } = req.body;

    const previousData = req.factory.toJSON();

    await req.factory.update({
      companyName: companyName || req.factory.companyName,
      contactPerson: contactPerson !== undefined ? contactPerson : req.factory.contactPerson,
      phone: phone || req.factory.phone,
      address: address !== undefined ? address : req.factory.address,
      city: city !== undefined ? city : req.factory.city,
      country: country !== undefined ? country : req.factory.country,
      paymentTerms: paymentTerms || req.factory.paymentTerms,
      leadTimeDays: leadTimeDays !== undefined ? leadTimeDays : req.factory.leadTimeDays,
      notes: notes !== undefined ? notes : req.factory.notes
    });

    const updated = await db.Factory.findByPk(req.factory.id);
    res.json(getSuccessResponse(updated, 'Factory profile updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'UPDATE',
      'Factory',
      req.factory.id,
      { before: previousData, after: updated.toJSON() },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /products - List products for this factory
router.get('/products', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { factoryId: req.factory.id, isActive: true };
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await db.Product.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      include: [
        { model: db.ProductCategory, as: 'category' }
      ],
      order: [['name', 'ASC']]
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
});

// Helper function to anonymize customer data in purchase orders
const anonymizeCustomerData = (po) => {
  const anonymized = po.toJSON ? po.toJSON() : { ...po };

  // Generate anonymous customer reference based on index or ID
  if (po.SalesOrder && po.SalesOrder.Customer) {
    const customerId = po.SalesOrder.Customer.id;
    const customerHash = customerId.split('-')[0]; // Use first part of UUID
    anonymized.customerReference = `Client-${customerHash}`;

    // Remove sensitive customer info
    if (anonymized.SalesOrder) {
      delete anonymized.SalesOrder.Customer;
      anonymized.SalesOrder.customerReference = `Client-${customerHash}`;
    }
  }

  return anonymized;
};

// GET /purchase-orders - List POs for this factory
router.get('/purchase-orders', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { factoryId: req.factory.id };
    if (status) where.status = status;

    const { count, rows } = await db.PurchaseOrder.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      include: [
        { model: db.PurchaseOrderItem, as: 'items' },
        { model: db.SalesOrder, as: 'salesOrder', attributes: ['id', 'orderNumber'], include: [{ model: db.Customer, as: 'customer' }] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Anonymize customer data in each PO
    const anonymizedRows = rows.map(po => anonymizeCustomerData(po));

    res.json(getPaginatedResponse(anonymizedRows, count, page, limit));
  } catch (error) {
    next(error);
  }
});

// GET /purchase-orders/:id - Get single PO
router.get('/purchase-orders/:id', async (req, res, next) => {
  try {
    const po = await db.PurchaseOrder.findOne({
      where: {
        id: req.params.id,
        factoryId: req.factory.id
      },
      include: [
        { model: db.PurchaseOrderItem, as: 'items' },
        { model: db.SalesOrder, as: 'salesOrder', include: [{ model: db.Customer, as: 'customer' }] }
      ]
    });

    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }

    // Anonymize customer data
    const anonymizedPo = anonymizeCustomerData(po);

    res.json(getSuccessResponse(anonymizedPo, 'Purchase order retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// POST /purchase-orders/:id/confirm - Confirm PO
router.post('/purchase-orders/:id/confirm', async (req, res, next) => {
  try {
    const po = await db.PurchaseOrder.findOne({
      where: {
        id: req.params.id,
        factoryId: req.factory.id
      }
    });

    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }

    if (po.status !== 'sent' && po.status !== 'draft') {
      throw new ValidationError('Only sent or draft purchase orders can be confirmed');
    }

    const previousStatus = po.status;
    await po.update({ status: 'confirmed' });

    const updated = await db.PurchaseOrder.findByPk(po.id, {
      include: [
        { model: db.PurchaseOrderItem, as: 'items' }
      ]
    });

    res.json(getSuccessResponse(updated, 'Purchase order confirmed successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'CONFIRM_PO',
      'PurchaseOrder',
      po.id,
      { previousStatus, newStatus: 'confirmed' },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// POST /purchase-orders/:id/reject - Reject PO
router.post('/purchase-orders/:id/reject', async (req, res, next) => {
  try {
    const { reason } = req.body;

    const po = await db.PurchaseOrder.findOne({
      where: {
        id: req.params.id,
        factoryId: req.factory.id
      }
    });

    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }

    if (po.status !== 'sent' && po.status !== 'draft') {
      throw new ValidationError('Only sent or draft purchase orders can be rejected');
    }

    const previousStatus = po.status;
    await po.update({ status: 'cancelled' });

    const updated = await db.PurchaseOrder.findByPk(po.id);
    res.json(getSuccessResponse(updated, 'Purchase order rejected successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'REJECT_PO',
      'PurchaseOrder',
      po.id,
      { previousStatus, newStatus: 'cancelled', reason },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /shipments - List shipments for this factory
router.get('/shipments', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const { offset } = getPagination(page, limit);

    // Get factory's sales order IDs via purchase orders
    const factoryPOs = await db.PurchaseOrder.findAll({
      where: { factoryId: req.factory.id },
      attributes: ['salesOrderId']
    });
    const soIds = factoryPOs.map(po => po.salesOrderId).filter(Boolean);

    const shipmentWhere = { salesOrderId: { [Op.in]: soIds } };
    if (status) shipmentWhere.status = status;

    const { count, rows } = await db.Shipment.findAndCountAll({
      where: shipmentWhere,
      offset,
      limit: parseInt(limit),
      include: [
        { model: db.ShipmentTracking, as: 'tracking' }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
});

// GET /shipments/:id - Get single shipment
router.get('/shipments/:id', async (req, res, next) => {
  try {
    const shipment = await db.Shipment.findByPk(req.params.id, {
      include: [
        { model: db.ShipmentTracking, as: 'tracking' }
      ]
    });

    if (!shipment) {
      throw new NotFoundError('Shipment not found');
    }

    // Verify this shipment belongs to one of the factory's sales orders
    const factoryPOs = await db.PurchaseOrder.findAll({
      where: { factoryId: req.factory.id },
      attributes: ['salesOrderId']
    });
    const soIds = factoryPOs.map(po => po.salesOrderId).filter(Boolean);
    if (!soIds.includes(shipment.salesOrderId)) {
      throw new NotFoundError('Shipment not found');
    }

    res.json(getSuccessResponse(shipment, 'Shipment retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// POST /shipments - Create shipment
router.post('/shipments', async (req, res, next) => {
  try {
    const { purchaseOrderId, trackingNumber, carrier, estimatedDelivery, notes } = req.body;

    if (!purchaseOrderId) {
      throw new ValidationError('Purchase order ID is required');
    }

    const po = await db.PurchaseOrder.findOne({
      where: {
        id: purchaseOrderId,
        factoryId: req.factory.id
      }
    });

    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }

    const shipment = await db.Shipment.create({
      salesOrderId: po.salesOrderId,
      shipmentNumber: `SHP-${Date.now()}`,
      carrier: carrier || null,
      eta: estimatedDelivery || null,
      notes: notes || null,
      status: 'booked'
    });

    const result = await db.Shipment.findByPk(shipment.id, {
      include: [
        { model: db.ShipmentTracking, as: 'tracking' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Shipment created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'CREATE',
      'Shipment',
      shipment.id,
      { purchaseOrderId, trackingNumber, carrier, estimatedDelivery },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// PUT /shipments/:id - Update shipment
router.put('/shipments/:id', async (req, res, next) => {
  try {
    const { trackingNumber, carrier, estimatedDelivery, status, notes } = req.body;

    const shipment = await db.Shipment.findByPk(req.params.id);

    if (!shipment) {
      throw new NotFoundError('Shipment not found');
    }

    const previousData = shipment.toJSON();

    await shipment.update({
      carrier: carrier !== undefined ? carrier : shipment.carrier,
      eta: estimatedDelivery !== undefined ? estimatedDelivery : shipment.eta,
      status: status !== undefined ? status : shipment.status,
      notes: notes !== undefined ? notes : shipment.notes
    });

    const updated = await db.Shipment.findByPk(shipment.id, {
      include: [
        { model: db.ShipmentTracking, as: 'tracking' }
      ]
    });

    res.json(getSuccessResponse(updated, 'Shipment updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'UPDATE',
      'Shipment',
      shipment.id,
      { before: previousData, after: updated.toJSON() },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /inspections/schedule - Get inspection schedule for factory
router.get('/inspections/schedule', async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    const { count, rows } = await db.Inspection.findAndCountAll({
      where: { factoryId: req.factory.id },
      offset,
      limit: parseInt(limit),
      order: [['scheduledDate', 'ASC']]
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
});

// GET /inspections/:id - Get inspection detail
router.get('/inspections/:id', async (req, res, next) => {
  try {
    const inspection = await db.Inspection.findOne({
      where: {
        id: req.params.id,
        factoryId: req.factory.id
      }
    });

    if (!inspection) {
      throw new NotFoundError('Inspection not found');
    }

    res.json(getSuccessResponse(inspection, 'Inspection retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// POST /inspections/:id/confirm - Confirm inspection
router.post('/inspections/:id/confirm', async (req, res, next) => {
  try {
    const { result, notes } = req.body;

    const inspection = await db.Inspection.findOne({
      where: {
        id: req.params.id,
        factoryId: req.factory.id
      }
    });

    if (!inspection) {
      throw new NotFoundError('Inspection not found');
    }

    const previousStatus = inspection.status;
    await inspection.update({
      status: 'confirmed',
      result: result || inspection.result,
      notes: notes || inspection.notes
    });

    const updated = await db.Inspection.findByPk(inspection.id);
    res.json(getSuccessResponse(updated, 'Inspection confirmed successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'CONFIRM_INSPECTION',
      'InspectionReport',
      inspection.id,
      { previousStatus, newStatus: 'confirmed', result },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /documents - List factory documents
router.get('/documents', async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    const { count, rows } = await db.Document.findAndCountAll({
      where: { factoryId: req.factory.id },
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
});

// POST /documents - Upload document (use multer)
router.post('/documents', uploadSingle('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('File is required');
    }

    const { name, category } = req.body;

    const document = await db.Document.create({
      factoryId: req.factory.id,
      name: name || req.file.originalname,
      category: category || 'other',
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id
    });

    const result = await db.Document.findByPk(document.id);
    res.status(201).json(getSuccessResponse(result, 'Document uploaded successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'UPLOAD_DOCUMENT',
      'Document',
      document.id,
      { name, category, fileName: req.file.filename },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/kpis - Factory KPIs
router.get('/dashboard/kpis', async (req, res, next) => {
  try {
    const totalPOs = await db.PurchaseOrder.count({ where: { factoryId: req.factory.id } });
    const completedPOs = await db.PurchaseOrder.count({ where: { factoryId: req.factory.id, status: 'completed' } });
    // Shipments don't have factoryId directly - count POs that have been shipped
    const shippedPOs = await db.PurchaseOrder.count({ where: { factoryId: req.factory.id, status: 'shipped' } });
    const totalShipments = shippedPOs;
    const activeShipments = shippedPOs;

    const kpis = {
      totalPurchaseOrders: totalPOs,
      completedPurchaseOrders: completedPOs,
      completionRate: totalPOs > 0 ? ((completedPOs / totalPOs) * 100).toFixed(2) : 0,
      totalShipments,
      activeShipments,
      rating: req.factory.rating || 5.0
    };

    res.json(getSuccessResponse(kpis, 'KPIs retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/recent-pos - Recent POs for factory
router.get('/dashboard/recent-pos', async (req, res, next) => {
  try {
    const limit = 5;
    const recentPOs = await db.PurchaseOrder.findAll({
      where: { factoryId: req.factory.id },
      limit,
      order: [['createdAt', 'DESC']],
      include: [
        { model: db.PurchaseOrderItem, as: 'items' }
      ]
    });

    res.json(getSuccessResponse(recentPOs, 'Recent purchase orders retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/revenue - Revenue chart for factory
router.get('/dashboard/revenue', async (req, res, next) => {
  try {
    const { period = '6months' } = req.query;
    const months = period === '12months' ? 12 : period === '3months' ? 3 : 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const pos = await db.PurchaseOrder.findAll({
      where: { factoryId: req.factory.id, createdAt: { [Op.gte]: startDate } },
      attributes: ['total', 'createdAt'],
      order: [['createdAt', 'ASC']]
    });

    const monthlyData = {};
    pos.forEach(po => {
      const date = new Date(po.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) monthlyData[key] = { month: key, revenue: 0, orders: 0 };
      monthlyData[key].revenue += parseFloat(po.total || 0);
      monthlyData[key].orders += 1;
    });

    res.json(getSuccessResponse(Object.values(monthlyData)));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/po-status-distribution - PO status breakdown
router.get('/dashboard/po-status-distribution', async (req, res, next) => {
  try {
    const statuses = ['draft', 'sent', 'confirmed', 'in_production', 'completed', 'cancelled'];
    const distribution = [];
    for (const status of statuses) {
      const count = await db.PurchaseOrder.count({ where: { factoryId: req.factory.id, status } });
      if (count > 0) distribution.push({ status, count });
    }
    res.json(getSuccessResponse(distribution));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/upcoming-deadlines - POs with upcoming deadlines
router.get('/dashboard/upcoming-deadlines', async (req, res, next) => {
  try {
    const pos = await db.PurchaseOrder.findAll({
      where: {
        factoryId: req.factory.id,
        status: { [Op.in]: ['confirmed', 'in_production'] },
        expectedDelivery: { [Op.gte]: new Date() }
      },
      order: [['expectedDelivery', 'ASC']],
      limit: 10,
      attributes: ['id', 'poNumber', 'expectedDelivery', 'status', 'total']
    });
    res.json(getSuccessResponse(pos));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/inspection-schedule - Upcoming inspections
router.get('/dashboard/inspection-schedule', async (req, res, next) => {
  try {
    const inspections = await db.Inspection.findAll({
      where: {
        factoryId: req.factory.id,
        status: { [Op.in]: ['scheduled', 'pending'] }
      },
      order: [['scheduledDate', 'ASC']],
      limit: 10
    });
    res.json(getSuccessResponse(inspections));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/action-items - Pending action items for factory
router.get('/dashboard/action-items', async (req, res, next) => {
  try {
    const actionItems = [];

    // Unconfirmed POs
    const unconfirmedPOs = await db.PurchaseOrder.count({
      where: { factoryId: req.factory.id, status: 'sent' }
    });
    if (unconfirmedPOs > 0) actionItems.push({ type: 'po_confirmation', title: 'Purchase Orders Pending Confirmation', count: unconfirmedPOs, priority: 'high' });

    // POs ready to ship
    const readyToShip = await db.PurchaseOrder.count({
      where: { factoryId: req.factory.id, status: 'ready' }
    });
    if (readyToShip > 0) actionItems.push({ type: 'shipment_pending', title: 'POs Ready to Ship', count: readyToShip, priority: 'medium' });

    // Pending inspections
    const pendingInspections = await db.Inspection.count({
      where: { factoryId: req.factory.id, status: { [Op.in]: ['scheduled', 'pending'] } }
    });
    if (pendingInspections > 0) actionItems.push({ type: 'inspection_pending', title: 'Inspections Scheduled', count: pendingInspections, priority: 'medium' });

    res.json(getSuccessResponse(actionItems));
  } catch (error) {
    next(error);
  }
});

// GET /settings/notifications - Get notification prefs
router.get('/settings/notifications', async (req, res, next) => {
  try {
    const factory = await db.Factory.findByPk(req.factory.id);

    const notificationPrefs = factory.notificationPreferences || {
      emailNotifications: true,
      smsNotifications: false,
      poConfirmation: true,
      shipmentUpdates: true,
      inspectionNotifications: true,
      paymentReminders: true
    };

    res.json(getSuccessResponse(notificationPrefs, 'Notification preferences retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// PUT /settings/notifications - Update notification prefs
router.put('/settings/notifications', async (req, res, next) => {
  try {
    const { emailNotifications, smsNotifications, poConfirmation, shipmentUpdates, inspectionNotifications, paymentReminders } = req.body;

    const notificationPrefs = {
      emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
      smsNotifications: smsNotifications !== undefined ? smsNotifications : false,
      poConfirmation: poConfirmation !== undefined ? poConfirmation : true,
      shipmentUpdates: shipmentUpdates !== undefined ? shipmentUpdates : true,
      inspectionNotifications: inspectionNotifications !== undefined ? inspectionNotifications : true,
      paymentReminders: paymentReminders !== undefined ? paymentReminders : true
    };

    await req.factory.update({ notificationPreferences: notificationPrefs });

    res.json(getSuccessResponse(notificationPrefs, 'Notification preferences updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(
      req.user.id,
      'UPDATE',
      'NotificationPreferences',
      req.factory.id,
      { notificationPreferences: notificationPrefs },
      req.ip
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
